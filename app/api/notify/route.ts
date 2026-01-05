// app/api/notify/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

interface Recipient {
  email: string;
  name?: string;
  amountOwed?: number;
}

const BATCH_SIZE = 10; // Start small for testing

export async function POST(request: Request) {
  // Log environment info
  console.log("=== NOTIFY API CALLED ===");
  console.log("Time:", new Date().toISOString());
  console.log("Node Environment:", process.env.NODE_ENV);
  console.log("BREVO_API_KEY exists:", !!process.env.BREVO_API_KEY);
  console.log("BREVO_API_KEY length:", process.env.BREVO_API_KEY?.length);
  console.log("BREVO_API_KEY first 10 chars:", process.env.BREVO_API_KEY?.substring(0, 10) + "...");
  console.log("NEXT_PUBLIC_APP_URL:", process.env.NEXT_PUBLIC_APP_URL);
  
  try {
    // Parse request
    const body = await request.json();
    console.log("Request body:", JSON.stringify(body, null, 2));

    const {
      type, // 'EXPENSE' | 'SETTLEMENT' | 'GROUP'
      action, // 'ADDED' | 'EDITED' | 'DELETED' | 'MEMBER_REMOVED' | 'OWNERSHIP_TRANSFERRED'
      amount,
      payerName = "A friend",
      groupName = "Trip",
      recipients,
      description = "",
    } = body;

    // Validate
    if (!Array.isArray(recipients) || recipients.length === 0) {
      console.log("No recipients array or empty");
      return NextResponse.json(
        { success: false, message: "No recipients" },
        { status: 400 }
      );
    }

    // Check Brevo API key with more detail
    if (!process.env.BREVO_API_KEY) {
      console.error("BREVO_API_KEY is undefined or empty");
      console.log("All env vars:", Object.keys(process.env).sort());
      return NextResponse.json(
        { 
          success: false, 
          message: "Email service not configured",
          debug: {
            envVars: Object.keys(process.env).filter(k => k.includes('BREVO') || k.includes('API'))
          }
        },
        { status: 500 }
      );
    }

    // Validate API key format
    if (!process.env.BREVO_API_KEY.startsWith('xkeysib-')) {
      console.error("Invalid Brevo API key format");
      return NextResponse.json(
        { 
          success: false, 
          message: "Invalid API key format",
          debug: { 
            keyStartsWith: process.env.BREVO_API_KEY.substring(0, 10),
            expectedStart: "xkeysib-"
          }
        },
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

    console.log("Email subject:", subject);
    console.log("HTML length:", html.length);

    // Send test email to first recipient
    const testRecipient = recipients[0];
    console.log("Test recipient:", testRecipient);

    try {
      const testResult = await sendSingleEmail({
        recipient: testRecipient,
        subject,
        html,
        type,
        action,
        batchIndex: 0
      });

      console.log("✅ Test email sent successfully:", testResult.messageId);

      // Send to remaining recipients if test succeeded
      const remainingRecipients = recipients.slice(1);
      if (remainingRecipients.length > 0) {
        // Send in batches
        const batches = [];
        for (let i = 0; i < remainingRecipients.length; i += BATCH_SIZE) {
          const batchRecipients = remainingRecipients.slice(i, i + BATCH_SIZE);
          batches.push(batchRecipients);
        }

        console.log(`📦 Sending remaining ${remainingRecipients.length} emails in ${batches.length} batches`);

        const results = await Promise.allSettled(
          batches.map((batch, index) => 
            sendEmailBatch(batch, subject, html, type, action, index + 1)
          )
        );

        // Process results
        const successfulBatches: string[] = [testResult.messageId];
        const failedBatches: Array<{batch: number, error: string}> = [];
        let totalSent = 1; // Count test email

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
            total: batches.length + 1, // +1 for test email
            successful: successfulBatches.length,
            failed: failedBatches.length,
            failedDetails: failedBatches.length > 0 ? failedBatches : undefined
          },
          messageIds: successfulBatches,
        };

        if (failedBatches.length > 0) {
          console.warn(`⚠️ ${failedBatches.length} batch(es) failed`, failedBatches);
          return NextResponse.json(responseData, { status: 207 });
        }

        console.log(`✅ All emails sent successfully (${totalSent}/${recipients.length})`);
        return NextResponse.json(responseData);
      }

      // If only test recipient
      return NextResponse.json({
        success: true,
        totalRecipients: 1,
        totalSent: 1,
        messageId: testResult.messageId,
        message: "Test email sent successfully"
      });

    } catch (emailError: any) {
      console.error("❌ Email sending failed:", emailError);
      
      // Check for specific Brevo errors
      if (emailError.message?.includes('unauthorized') || 
          emailError.message?.includes('Invalid api key')) {
        return NextResponse.json(
          { 
            success: false, 
            message: "Invalid Brevo API key",
            debug: { 
              error: emailError.message,
              apiKeyExists: !!process.env.BREVO_API_KEY
            }
          },
          { status: 401 }
        );
      }
      
      if (emailError.message?.includes('sender not verified')) {
        return NextResponse.json(
          { 
            success: false, 
            message: "Sender email not verified in Brevo",
            debug: { error: emailError.message }
          },
          { status: 400 }
        );
      }

      throw emailError;
    }

  } catch (error: any) {
    console.error("❌ Unexpected error in notify API:", error);
    console.error("Error stack:", error.stack);
    
    return NextResponse.json(
      { 
        success: false, 
        message: error.message || "Internal error",
        debug: {
          errorType: error.constructor.name,
          nodeVersion: process.version,
          timestamp: new Date().toISOString()
        }
      },
      { status: 500 }
    );
  }
}

/**
 * Send a single email for testing
 */
async function sendSingleEmail({
  recipient,
  subject,
  html,
  type,
  action,
  batchIndex
}: {
  recipient: Recipient,
  subject: string,
  html: string,
  type: string,
  action: string,
  batchIndex: number
}) {
  console.log(`Sending test email to ${recipient.email}...`);
  
  const payload = {
    sender: {
      name: "TravelSplit",
      email: "tripsplit8@gmail.com",
    },
    to: [{
      email: recipient.email,
      name: recipient.name || undefined,
    }],
    subject,
    htmlContent: html, // ACTUAL HTML CONTENT
    tags: ["travelsplit", type.toLowerCase(), action.toLowerCase(), `test_batch_${batchIndex}`],
    replyTo: {
      email: "tripsplit8@gmail.com",
      name: "TravelSplit Support"
    }
  };

  // Log truncated payload for debugging
  console.log("Brevo API payload (truncated):", {
    ...payload,
    htmlContent: html.length > 100 ? html.substring(0, 100) + '...' : html
  });

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "api-key": process.env.BREVO_API_KEY!,
    },
    body: JSON.stringify(payload), // NO REPLACER FUNCTION HERE
  });

  console.log("Brevo API response status:", response.status);
  
  const responseText = await response.text();
  console.log("Brevo API response text:", responseText);

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    console.error("Failed to parse Brevo response as JSON:", responseText);
    throw new Error(`Invalid response from Brevo: ${responseText.substring(0, 200)}`);
  }

  if (!response.ok) {
    console.error("Brevo API error:", data);
    throw new Error(data.message || `HTTP ${response.status}: ${JSON.stringify(data)}`);
  }

  console.log("✅ Test email API call successful:", data.messageId);
  return {
    messageId: data.messageId,
    sentCount: 1
  };
}

/**
 * Send a batch of emails
 */
async function sendEmailBatch(
  recipients: Recipient[], 
  subject: string, 
  html: string, // ACTUAL HTML
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
    htmlContent: html, // ACTUAL HTML
    tags: ["travelsplit", type.toLowerCase(), action.toLowerCase(), `batch_${batchIndex}`],
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
    body: JSON.stringify(payload), // NO REPLACER
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `HTTP ${response.status}`);
  }

  console.log(`✅ Batch ${batchIndex} sent: ${data.messageId}`);
  return {
    messageId: data.messageId,
    sentCount: recipients.length
  };
}
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
