// app/api/notify/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30; // Increased for batching

interface Recipient {
  email: string;
  name?: string;
  amountOwed?: number;
}

const BATCH_SIZE = 50; // Brevo allows up to 1000 recipients per batch, 50 is safe

export async function POST(request: Request) {
  try {
    // Parse request
    const {
      type, // 'EXPENSE' | 'SETTLEMENT' | 'GROUP'
      action, // 'ADDED' | 'EDITED' | 'DELETED' | 'MEMBER_REMOVED' | 'OWNERSHIP_TRANSFERRED'
      amount,
      payerName = "A friend",
      groupName = "Trip",
      recipients,
      description = "",
    } = await request.json();

    // Validate
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { success: false, message: "No recipients" },
        { status: 400 }
      );
    }

    if (!process.env.BREVO_API_KEY) {
      console.error("BREVO_API_KEY missing");
      return NextResponse.json(
        { success: false, message: "Email service not configured" },
        { status: 500 }
      );
    }

    console.log(`📧 Preparing to send ${type} email to ${recipients.length} recipients`);

    // Build email template
    const { subject, html } = buildEmail({
      type,
      action,
      amount,
      payerName,
      groupName,
      description,
    });

    // Send in batches
    const batches = [];
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batchRecipients = recipients.slice(i, i + BATCH_SIZE);
      batches.push(batchRecipients);
    }

    console.log(`📦 Sending in ${batches.length} batches`);

    const results = await Promise.allSettled(
      batches.map((batch, index) => 
        sendEmailBatch(batch, subject, html, type, action, index)
      )
    );

    // Process results
    const successfulBatches: string[] = [];
    const failedBatches: Array<{batch: number, error: string}> = [];
    let totalSent = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successfulBatches.push(result.value.messageId);
        totalSent += result.value.sentCount;
      } else {
        failedBatches.push({
          batch: index + 1,
          error: result.reason.message || 'Unknown error'
        });
        console.error(`Batch ${index + 1} failed:`, result.reason);
      }
    });

    const responseData = {
      success: failedBatches.length === 0,
      totalRecipients: recipients.length,
      totalSent,
      batches: {
        total: batches.length,
        successful: successfulBatches.length,
        failed: failedBatches.length,
        failedDetails: failedBatches.length > 0 ? failedBatches : undefined
      },
      messageIds: successfulBatches,
    };

    if (failedBatches.length > 0) {
      console.warn(`⚠️ ${failedBatches.length} batch(es) failed`, failedBatches);
      return NextResponse.json(responseData, { status: 207 }); // Multi-status
    }

    console.log(`✅ All ${batches.length} batches sent successfully`);
    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * Send a single batch of emails
 */
async function sendEmailBatch(
  recipients: Recipient[], 
  subject: string, 
  html: string, 
  type: string, 
  action: string,
  batchIndex: number
) {
  const payload = {
    sender: {
      name: "TravelSplit",
      email: "tripsplit8@gmail.com",
    },
    to: recipients.map((r: Recipient) => ({
      email: r.email,
      name: r.name || undefined,
    })),
    subject,
    htmlContent: html,
    tags: ["travelsplit", type.toLowerCase(), action.toLowerCase(), `batch_${batchIndex + 1}`],
    replyTo: {
      email: "tripsplit8@gmail.com",
      name: "TravelSplit Support"
    }
  };

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "api-key": process.env.BREVO_API_KEY!,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `HTTP ${response.status}`);
  }

  console.log(`✅ Batch ${batchIndex + 1} sent: ${data.messageId}`);
  return {
    messageId: data.messageId,
    sentCount: recipients.length
  };
}

/**
 * Reusable email templates
 */
/**
 * Build beautiful HTML emails
 */
function buildEmail({ type, action, amount, payerName, groupName, description, category = "Other" }: any) {
  let subject = "";
  let html = "";

  const amountStr = amount ? `₹${amount.toLocaleString('en-IN')}` : "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://travel-split-8.vercel.app";
  
  // Category icon mapping
  const categoryIcons: Record<string, string> = {
    "Food": "🍽️",
    "Local Transport": "🚗",
    "Travel": "✈️",
    "Hostel / Hotel": "🏨",
    "Shopping": "🛍️",
    "Activity": "🎯",
    "Other": "💼"
  };
  
  const categoryIcon = categoryIcons[category] || "💰";

  // ========== EXPENSE EMAILS ==========
  if (type === "EXPENSE" || type === "SETTLEMENT") {
    const verb = action === "ADDED" ? "added" : 
                 action === "EDITED" ? "updated" : "deleted";
    
    const title = type === "EXPENSE" ? `Expense ${verb}` : `Payment ${verb}`;
    subject = `${title} in ${groupName}`;

    html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - TravelSplit</title>
    <style>
        /* Base Styles */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1e293b;
            background-color: #f8fafc;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        
        .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .email-container {
            background: #ffffff;
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.05);
        }
        
        /* Header */
        .header {
            background: linear-gradient(135deg, #00A896 0%, #0d9488 100%);
            padding: 48px 40px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        
        .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none" opacity="0.1"><path d="M0,0 L100,0 L100,100 Z" fill="white"/></svg>');
            background-size: cover;
        }
        
        .logo-container {
            position: relative;
            z-index: 2;
        }
        
        .logo {
            font-size: 42px;
            font-weight: 800;
            letter-spacing: -1px;
            margin-bottom: 12px;
            color: white;
            display: inline-flex;
            align-items: center;
            gap: 16px;
            background: rgba(255, 255, 255, 0.15);
            padding: 16px 32px;
            border-radius: 20px;
            backdrop-filter: blur(10px);
        }
        
        .logo-icon {
            font-size: 28px;
        }
        
        .tagline {
            font-size: 16px;
            color: rgba(255, 255, 255, 0.9);
            font-weight: 500;
            letter-spacing: 0.5px;
            position: relative;
            z-index: 2;
        }
        
        /* Content */
        .content {
            padding: 48px 40px;
        }
        
        .title {
            font-size: 32px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 24px;
            text-align: center;
            line-height: 1.2;
        }
        
        .message {
            font-size: 18px;
            color: #475569;
            text-align: center;
            margin-bottom: 40px;
            line-height: 1.7;
        }
        
        .highlight-card {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border-radius: 20px;
            padding: 40px;
            margin: 40px 0;
            border: 1px solid #e2e8f0;
            box-shadow: 0 8px 24px rgba(0, 168, 150, 0.08);
        }
        
        .amount-display {
            text-align: center;
            margin-bottom: 32px;
        }
        
        .amount {
            font-size: 64px;
            font-weight: 800;
            color: #00A896;
            line-height: 1;
            margin-bottom: 16px;
            letter-spacing: -2px;
            text-shadow: 0 4px 12px rgba(0, 168, 150, 0.15);
        }
        
        .amount-label {
            font-size: 16px;
            color: #64748b;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        /* Details Card - FIXED COLON SPACING */
        .details-card {
            background: white;
            border-radius: 16px;
            padding: 32px;
            border: 1px solid #e2e8f0;
        }
        
        .detail-row {
            display: flex;
            padding: 20px 0;
            border-bottom: 1px solid #f1f5f9;
            align-items: flex-start;
        }
        
        .detail-row:last-child {
            border-bottom: none;
            padding-bottom: 0;
        }
        
        .detail-row:first-child {
            padding-top: 0;
        }
        
        .detail-label {
            color: #64748b;
            font-weight: 500;
            font-size: 15px;
            width: 120px;
            flex-shrink: 0;
            padding-right: 16px;
        }
        
        /* FIX: Added colon after label */
        .detail-label::after {
            content: ":";
            display: inline-block;
            margin-left: 4px;
        }
        
        .detail-value {
            color: #0f172a;
            font-weight: 600;
            font-size: 16px;
            flex: 1;
            text-align: left;
        }
        
        /* Category Badge */
        .category-badge {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            background: #e6f7f5;
            color: #00A896;
            padding: 10px 20px;
            border-radius: 24px;
            font-size: 15px;
            font-weight: 600;
            margin-top: 8px;
        }
        
        /* Button */
        .button-container {
            text-align: center;
            margin: 48px 0 32px 0;
        }
        
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #00A896 0%, #0d9488 100%);
            color: white;
            text-decoration: none;
            padding: 20px 48px;
            border-radius: 16px;
            font-weight: 600;
            font-size: 18px;
            letter-spacing: 0.3px;
            transition: all 0.3s ease;
            box-shadow: 0 8px 24px rgba(0, 168, 150, 0.25);
            border: none;
            cursor: pointer;
        }
        
        .button:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 32px rgba(0, 168, 150, 0.35);
        }
        
        .button-subtext {
            font-size: 15px;
            color: #64748b;
            margin-top: 16px;
            line-height: 1.6;
        }
        
        /* Divider */
        .divider {
            height: 1px;
            background: linear-gradient(90deg, transparent, #cbd5e1, transparent);
            margin: 48px 0;
        }
        
        /* Footer - IMPROVED WITH BETTER STRUCTURE */
        .footer {
            background: #f8fafc;
            padding: 40px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
        }
        
        .footer-text {
            font-size: 14px;
            color: #64748b;
            line-height: 1.7;
            margin-bottom: 24px;
        }
        
        .footer-links {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 24px;
            flex-wrap: wrap;
        }
        
        .footer-link {
            color: #64748b;
            text-decoration: none;
            font-size: 14px;
            transition: color 0.2s;
            white-space: nowrap;
        }
        
        .footer-link:hover {
            color: #00A896;
        }
        
        /* Responsive */
        @media (max-width: 600px) {
            .email-wrapper {
                padding: 12px;
            }
            
            .header {
                padding: 40px 24px;
            }
            
            .content {
                padding: 40px 24px;
            }
            
            .logo {
                font-size: 36px;
                padding: 14px 24px;
            }
            
            .title {
                font-size: 28px;
            }
            
            .amount {
                font-size: 56px;
            }
            
            .highlight-card {
                padding: 32px 24px;
            }
            
            .details-card {
                padding: 24px 20px;
            }
            
            .detail-label {
                width: 100px;
                font-size: 14px;
            }
            
            .detail-value {
                font-size: 15px;
            }
            
            .button {
                padding: 18px 36px;
                font-size: 16px;
            }
            
            .footer {
                padding: 32px 24px;
            }
            
            .footer-links {
                gap: 16px;
            }
            
            .footer-link {
                font-size: 13px;
            }
        }
        
        @media (max-width: 400px) {
            .footer-links {
                flex-direction: column;
                gap: 12px;
            }
        }
        
        /* Status Badge */
        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: #10b981;
            color: white;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        /* Group Name Highlight */
        .group-name {
            color: #00A896;
            font-weight: 700;
        }
        
        /* Payer Highlight */
        .payer-name {
            color: #0f172a;
            font-weight: 700;
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-container">
            <!-- Header -->
            <div class="header">
                <div class="logo-container">
                    <div class="logo">
                        <span class="logo-icon">✈️</span>
                        TravelSplit
                    </div>
                    <p class="tagline">Split smarter, travel together</p>
                </div>
            </div>
            
            <!-- Content -->
            <div class="content">
                <h1 class="title">${title}</h1>
                
                <p class="message">
                    <span class="payer-name">${payerName}</span> ${verb} 
                    ${type === "EXPENSE" 
                      ? `the expense "<strong>${description}</strong>"`
                      : `a payment of <strong>${amountStr}</strong>`}
                    in <span class="group-name">${groupName}</span>.
                </p>
                
                <!-- Amount Highlight Card -->
                <div class="highlight-card">
                    <div class="amount-display">
                        <div class="amount">${amountStr}</div>
                        <div class="amount-label">
                            ${type === "EXPENSE" ? "Total Amount" : "Payment Amount"}
                        </div>
                    </div>
                    
                    <!-- Category Badge (only for expenses) -->
                    ${type === "EXPENSE" ? `
                    <div style="text-align: center; margin-bottom: 24px;">
                        <div class="category-badge">
                            ${categoryIcon} ${category}
                        </div>
                    </div>
                    ` : ''}
                    
                    <!-- Details Card with FIXED COLON SPACING -->
                    <div class="details-card">
                        <div class="detail-row">
                            <span class="detail-label">Paid By</span>
                            <span class="detail-value">${payerName}</span>
                        </div>
                        
                        ${type === "EXPENSE" ? `
                        <div class="detail-row">
                            <span class="detail-label">Description</span>
                            <span class="detail-value">${description}</span>
                        </div>
                        ` : ''}
                        
                        <div class="detail-row">
                            <span class="detail-label">Group</span>
                            <span class="detail-value">${groupName}</span>
                        </div>
                        
                        <div class="detail-row">
                            <span class="detail-label">Status</span>
                            <span class="detail-value">
                                <span class="status-badge">${verb.toUpperCase()}</span>
                            </span>
                        </div>
                    </div>
                </div>
                
                <!-- Action Button -->
                <div class="button-container">
                    <a href="${appUrl}" class="button">
                        👉 Open TravelSplit
                    </a>
                    <p class="button-subtext">
                        Track expenses, settle up, and manage your trip
                    </p>
                </div>
                
                <!-- Divider -->
                <div class="divider"></div>
                
                <!-- Help Text -->
                <p style="text-align: center; color: #64748b; font-size: 15px; line-height: 1.7;">
                    Need help? Reply to this email or contact our support team.<br>
                    This is an automated notification from TravelSplit.
                </p>
            </div>
            
            <!-- Footer - SIMPLIFIED AND CLEAN -->
            <div class="footer">
                <p class="footer-text">
                    © ${new Date().getFullYear()} TravelSplit. All rights reserved.<br>
                    Making travel expense sharing simple and stress-free.
                </p>
                
                <div class="footer-links">
                    <a href="${appUrl}/about" class="footer-link">About Us</a>
                    <a href="${appUrl}/terms" class="footer-link">Terms of Service</a>
                    <a href="${appUrl}/privacy" class="footer-link">Privacy Policy</a>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
    `;
  }

  // ========== GROUP EMAILS ==========
  if (type === "GROUP") {
    if (action === "MEMBER_REMOVED") {
      subject = `You've been removed from ${groupName}`;
      html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Group Update - TravelSplit</title>
    <style>
        .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
        .highlight-card { background: #fef2f2; border-color: #fecaca; }
        .button { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
        .status-badge { background: #ef4444; }
        /* Other styles same as above */
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-container">
            <div class="header">
                <div class="logo-container">
                    <div class="logo">
                        <span class="logo-icon">👥</span>
                        TravelSplit
                    </div>
                    <p class="tagline">Group Update</p>
                </div>
            </div>
            
            <div class="content">
                <h1 class="title">Removed from Group</h1>
                <p class="message">
                    You have been removed from <span class="group-name">${groupName}</span>.
                </p>
                
                <div class="highlight-card">
                    <div style="text-align: center; padding: 32px;">
                        <div style="font-size: 48px; margin-bottom: 24px;">📤</div>
                        <p style="margin: 0; color: #475569; font-size: 16px; line-height: 1.6;">
                            Your past expenses and activity in this group remain preserved in the history.
                        </p>
                    </div>
                </div>
                
                <div class="button-container">
                    <a href="${appUrl}" class="button">
                        View Your Trips
                    </a>
                </div>
            </div>
            
            <div class="footer">
                <p class="footer-text">
                    © ${new Date().getFullYear()} TravelSplit. All rights reserved.
                </p>
                <div class="footer-links">
                    <a href="${appUrl}/terms" class="footer-link">Terms of Service</a>
                    <a href="${appUrl}/privacy" class="footer-link">Privacy Policy</a>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
      `;
    }

    if (action === "OWNERSHIP_TRANSFERRED") {
      subject = `You're now the Admin of ${groupName}`;
      html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Admin Role - TravelSplit</title>
    <style>
        .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
        .highlight-card { background: #fef3c7; border-color: #fde68a; }
        .button { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
        .status-badge { background: #f59e0b; }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-container">
            <div class="header">
                <div class="logo-container">
                    <div class="logo">
                        <span class="logo-icon">👑</span>
                        TravelSplit
                    </div>
                    <p class="tagline">New Admin Role</p>
                </div>
            </div>
            
            <div class="content">
                <h1 class="title">🎉 You are now Admin!</h1>
                <p class="message">
                    The previous creator left <span class="group-name">${groupName}</span>.
                </p>
                
                <div class="highlight-card">
                    <div style="text-align: center; padding: 32px;">
                        <div style="font-size: 48px; margin-bottom: 24px;">🎯</div>
                        <p style="margin: 0; color: #475569; font-size: 17px; line-height: 1.7; font-weight: 500;">
                            <strong>You are now the new Admin</strong> of this trip. You have full control to manage members, expenses, and settings.
                        </p>
                    </div>
                </div>
                
                <div class="button-container">
                    <a href="${appUrl}" class="button">
                        Manage Group
                    </a>
                </div>
            </div>
            
            <div class="footer">
                <p class="footer-text">
                    © ${new Date().getFullYear()} TravelSplit. All rights reserved.
                </p>
                <div class="footer-links">
                    <a href="${appUrl}/terms" class="footer-link">Terms of Service</a>
                    <a href="${appUrl}/privacy" class="footer-link">Privacy Policy</a>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
      `;
    }

    if (action === "DELETED") {
      subject = `Trip Deleted: ${groupName}`;
      html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trip Closed - TravelSplit</title>
    <style>
        .header { background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); }
        .highlight-card { background: #f3f4f6; border-color: #d1d5db; }
        .button { background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); }
        .status-badge { background: #6b7280; }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-container">
            <div class="header">
                <div class="logo-container">
                    <div class="logo">
                        <span class="logo-icon">📁</span>
                        TravelSplit
                    </div>
                    <p class="tagline">Trip Closed</p>
                </div>
            </div>
            
            <div class="content">
                <h1 class="title">Trip Deleted</h1>
                <p class="message">
                    The admin has permanently deleted <span class="group-name">${groupName}</span>.
                </p>
                
                <div class="highlight-card">
                    <div style="text-align: center; padding: 32px;">
                        <div style="font-size: 48px; margin-bottom: 24px;">🗑️</div>
                        <p style="margin: 0; color: #475569; font-size: 16px; line-height: 1.6;">
                            Since all balances were settled, this trip and its history have been removed from the system.
                        </p>
                    </div>
                </div>
                
                <div class="button-container">
                    <a href="${appUrl}" class="button">
                        Create New Trip
                    </a>
                </div>
            </div>
            
            <div class="footer">
                <p class="footer-text">
                    © ${new Date().getFullYear()} TravelSplit. All rights reserved.
                </p>
                <div class="footer-links">
                    <a href="${appUrl}/terms" class="footer-link">Terms of Service</a>
                    <a href="${appUrl}/privacy" class="footer-link">Privacy Policy</a>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
      `;
    }
  }

  return { subject, html };
}

function getExpenseTemplate({ action, amountStr, payerName, groupName, description }: any) {
  const verb = action === "ADDED" ? "added" : 
               action === "EDITED" ? "updated" : "deleted";
  
  const subject = `Expense ${verb} in ${groupName}`;
  
  const html = getBaseTemplate({
    title: `Expense ${verb}`,
    headerColor: "linear-gradient(135deg, #00A896 0%, #14b8a6 100%)",
    tagline: "Split smarter, travel together",
    message: `
      <strong style="color: #00A896;">${payerName}</strong> ${verb} 
      the expense "<strong>${description}</strong>"
      in <strong>${groupName}</strong>.
    `,
    amount: amountStr,
    amountLabel: "Total Amount",
    buttonText: "👉 Open TravelSplit",
    buttonSubtext: "Track expenses, settle up, and manage your trip"
  });

  return { subject, html };
}

function getSettlementTemplate({ action, amountStr, payerName, groupName }: any) {
  const verb = action === "ADDED" ? "added" : 
               action === "EDITED" ? "updated" : "deleted";
  
  const subject = `Payment ${verb} in ${groupName}`;
  
  const html = getBaseTemplate({
    title: `Payment ${verb}`,
    headerColor: "linear-gradient(135deg, #00A896 0%, #14b8a6 100%)",
    tagline: "Split smarter, travel together",
    message: `
      <strong style="color: #00A896;">${payerName}</strong> ${verb} 
      a payment of <strong>${amountStr}</strong>
      in <strong>${groupName}</strong>.
    `,
    amount: amountStr,
    amountLabel: "Payment Amount",
    buttonText: "👉 Open TravelSplit",
    buttonSubtext: "Track expenses, settle up, and manage your trip"
  });

  return { subject, html };
}

function getGroupTemplate({ action, groupName }: any) {
  const templates: Record<string, () => { subject: string; html: string }> = {
    MEMBER_REMOVED: () => ({
      subject: `You've been removed from ${groupName}`,
      html: getBaseTemplate({
        title: "Removed from Group",
        headerColor: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
        tagline: "Group Update",
        message: `You have been removed from <strong>${groupName}</strong>.`,
        customContent: `
          <div class="highlight">
            <p style="margin: 0; color: #4a5568;">
              Your past expenses and activity in this group remain preserved in the history.
            </p>
          </div>
        `,
        buttonText: "View Your Trips",
        hideAmount: true
      })
    }),
    
    OWNERSHIP_TRANSFERRED: () => ({
      subject: `You're now the Admin of ${groupName}`,
      html: getBaseTemplate({
        title: "🎉 You are now Admin!",
        headerColor: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
        tagline: "New Admin Role",
        message: `The previous creator left <strong>${groupName}</strong>.`,
        customContent: `
          <div class="highlight">
            <p style="margin: 0; color: #4a5568; font-size: 17px;">
              <strong>You are now the new Admin</strong> of this trip. You have full control to manage members, expenses, and settings.
            </p>
          </div>
        `,
        buttonText: "Manage Group",
        hideAmount: true
      })
    }),
    
    DELETED: () => ({
      subject: `Trip Deleted: ${groupName}`,
      html: getBaseTemplate({
        title: "Trip Deleted",
        headerColor: "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)",
        tagline: "Trip Closed",
        message: `The admin has permanently deleted <strong>${groupName}</strong>.`,
        customContent: `
          <div class="highlight">
            <p style="margin: 0; color: #4a5568;">
              Since all balances were settled, this trip and its history have been removed from the system.
            </p>
          </div>
        `,
        buttonText: "Create New Trip",
        hideAmount: true
      })
    })
  };

  const templateFn = templates[action];
  if (!templateFn) {
    throw new Error(`Unknown group action: ${action}`);
  }

  return templateFn();
}

interface TemplateOptions {
  title: string;
  headerColor: string;
  tagline: string;
  message: string;
  amount?: string;
  amountLabel?: string;
  customContent?: string;
  buttonText: string;
  buttonSubtext?: string;
  hideAmount?: boolean;
}

function getBaseTemplate(options: TemplateOptions): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          background: #f8f9fa;
          -webkit-font-smoothing: antialiased;
        }
        .container {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          margin: 20px;
        }
        .header {
          background: ${options.headerColor};
          color: white;
          padding: 32px 24px;
          text-align: center;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          margin: 0 0 8px 0;
        }
        .tagline {
          opacity: 0.9;
          margin: 0;
          font-size: 14px;
        }
        .content {
          padding: 32px 24px;
        }
        .title {
          color: #1a1a1a;
          margin-top: 0;
          font-size: 24px;
          text-align: center;
        }
        .message {
          color: #4a5568;
          font-size: 16px;
          line-height: 1.7;
          text-align: center;
        }
        .highlight {
          background: #f7fafc;
          border-left: 4px solid #00A896;
          padding: 20px;
          border-radius: 8px;
          margin: 24px 0;
        }
        .amount {
          font-size: 40px;
          font-weight: 800;
          color: #00A896;
          text-align: center;
          margin: 16px 0;
          letter-spacing: -1px;
        }
        .amount-label {
          text-align: center;
          color: #4a5568;
          margin: 0 0 24px 0;
          font-size: 14px;
        }
        .button {
          display: inline-block;
          background: #00A896;
          color: white;
          padding: 16px 32px;
          text-decoration: none;
          border-radius: 10px;
          font-weight: 600;
          font-size: 16px;
          margin: 8px 0;
          transition: all 0.2s;
          text-align: center;
        }
        .button:hover {
          background: #0d9488;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(0,168,150,0.2);
        }
        .footer {
          padding: 24px;
          background: #f8f9fa;
          text-align: center;
          color: #718096;
          font-size: 13px;
          border-top: 1px solid #e2e8f0;
        }
        .divider {
          height: 1px;
          background: #e2e8f0;
          margin: 24px 0;
        }
        @media (max-width: 480px) {
          .container {
            margin: 10px;
          }
          .header, .content {
            padding: 24px 16px;
          }
          .amount {
            font-size: 32px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">TravelSplit</div>
          <p class="tagline">${options.tagline}</p>
        </div>
        
        <div class="content">
          <h2 class="title">${options.title}</h2>
          
          <p class="message">${options.message}</p>
          
          ${options.customContent || ''}
          
          ${!options.hideAmount && options.amount ? `
            <div class="highlight">
              <div class="amount">${options.amount}</div>
              ${options.amountLabel ? `<p class="amount-label">${options.amountLabel}</p>` : ''}
            </div>
          ` : ''}
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="https://travel-split-8.vercel.app" class="button" target="_blank">
              ${options.buttonText}
            </a>
            ${options.buttonSubtext ? `
              <p style="color: #718096; font-size: 14px; margin-top: 12px;">
                ${options.buttonSubtext}
              </p>
            ` : ''}
          </div>
          
          <div class="divider"></div>
          
          <p style="color: #718096; font-size: 14px; text-align: center;">
            Need help? Reply to this email or visit our help center.
          </p>
        </div>
        
        <div class="footer">
          <p>This is an automated notification from TravelSplit.</p>
          <p>© ${new Date().getFullYear()} TravelSplit. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}