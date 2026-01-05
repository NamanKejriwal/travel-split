import { NextResponse } from "next/server";

export async function GET() {
  // Test 1: Direct environment access
  const directKey = process.env.BREVO_API_KEY;
  
  // Test 2: Try accessing via different method
  const allEnv = process.env;
  const envKeys = Object.keys(allEnv);
  
  // Test 3: Try to send a real test email
  let testResult = null;
  if (directKey && directKey.startsWith('xkeysib-')) {
    try {
      const testPayload = {
        sender: { name: "TravelSplit", email: "tripsplit8@gmail.com" },
        to: [{ email: "test@example.com", name: "Test" }],
        subject: "TravelSplit Test Email",
        htmlContent: "<h1>Test Email</h1><p>If you receive this, Brevo is working.</p>"
      };
      
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
          "api-key": directKey,
        },
        body: JSON.stringify(testPayload),
      });
      
      testResult = {
        status: response.status,
        ok: response.ok,
        text: await response.text()
      };
    } catch (error: any) {
      testResult = { error: error.message };
    }
  }
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    test: {
      directKeyExists: !!directKey,
      directKeyLength: directKey?.length,
      directKeyFirst8: directKey?.substring(0, 8),
      allEnvKeysCount: envKeys.length,
      envKeysWithAPI: envKeys.filter(k => k.includes('API') || k.includes('KEY')),
    },
    brevoTest: testResult,
    rawEnvSample: envKeys.slice(0, 10).map(k => ({ [k]: typeof allEnv[k] }))
  });
}