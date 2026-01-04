import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  const { 
    type,       // 'EXPENSE' | 'SETTLEMENT' | 'GROUP'
    action,     // 'ADDED', 'EDITED', 'DELETED', 'MEMBER_REMOVED', 'OWNERSHIP_TRANSFERRED'
    amount, 
    payerName, 
    groupName, 
    recipients, 
    description 
  } = await request.json();

  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ message: "No recipients" });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  try {
    const promises = recipients.map((r: any) => {
      let subject = "";
      let html = "";

      // --- 1. EXPENSES & SETTLEMENTS ---
      if (type === 'EXPENSE' || type === 'SETTLEMENT') {
        const verb = action === 'ADDED' ? 'added' : action === 'EDITED' ? 'updated' : 'deleted';
        const amountStr = `₹${amount}`;
        const title = type === 'EXPENSE' ? `Expense ${verb}` : `Payment ${verb}`;
        
        subject = `${title} in ${groupName}`;
        html = `
          <div style="font-family: sans-serif; color: #333; padding: 20px;">
            <h2 style="color: #00A896;">${title}</h2>
            <p><strong>${payerName}</strong> ${verb} ${type === 'EXPENSE' ? `the expense <strong>"${description}"</strong>` : `A Settlement of <strong>${amountStr}</strong>`} in <strong>${groupName}</strong>.</p>
            ${type === 'EXPENSE' ? `<p>Total Amount: <strong>${amountStr}</strong></p>` : ''}
            <a href="https://travel-split-8.vercel.app" style="background-color: #00A896; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Open App</a>
          </div>
        `;
      } 
      
      // --- 2. GROUP UPDATES (NEW) ---
      else if (type === 'GROUP') {
        if (action === 'MEMBER_REMOVED') {
          subject = `You have been removed from ${groupName}`;
          html = `
            <div style="font-family: sans-serif; color: #333; padding: 20px;">
              <h2 style="color: #ef4444;">Removed from Group</h2>
              <p>You have been removed from the group <strong>${groupName}</strong>.</p>
              <p>Your past expenses and activity in this group are still preserved in the history.</p>
            </div>
          `;
        } else if (action === 'OWNERSHIP_TRANSFERRED') {
          subject = `You are now the Admin of ${groupName}`;
          html = `
            <div style="font-family: sans-serif; color: #333; padding: 20px;">
              <h2 style="color: #f59e0b;">You are now Admin!</h2>
              <p>The previous creator left the group <strong>${groupName}</strong>.</p>
              <p><strong>You are now the new Admin</strong> of this trip. You have full control to manage members and settings.</p>
              <a href="https://travel-split-8.vercel.app" style="background-color: #00A896; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Manage Group</a>
            </div>
          `;
        }
        else if (action === 'DELETED') {
          subject = `Trip Deleted: ${groupName}`;
          html = `
            <div style="font-family: sans-serif; color: #333; padding: 20px;">
              <h2 style="color: #ef4444;">Trip Deleted</h2>
              <p>The admin has permanently deleted the group <strong>${groupName}</strong>.</p>
              <p>Since all balances were settled, this trip and its history have been removed.</p>
            </div>
          `;
        }
      }

      return transporter.sendMail({
        from: `"TravelSplit" <${process.env.GMAIL_USER}>`,
        to: r.email,
        subject,
        html
      });
    });

    await Promise.all(promises);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Email error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}