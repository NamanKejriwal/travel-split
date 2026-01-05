import { NextResponse } from "next/server";

export async function GET() {
  const allEnvVars = process.env;
  const filteredEnvVars: Record<string, string> = {};
  
  // Only show relevant env vars
  Object.keys(allEnvVars).forEach(key => {
    if (
      key.includes('BREVO') || 
      key.includes('API') || 
      key.includes('KEY') || 
      key.includes('URL') ||
      key === 'NODE_ENV'
    ) {
      const value = allEnvVars[key] || '';
      filteredEnvVars[key] = key.includes('KEY') 
        ? `${value.substring(0, 10)}...${value.substring(value.length - 4)}` 
        : value;
    }
  });

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV,
    envVars: filteredEnvVars,
    brevoKeyExists: !!process.env.BREVO_API_KEY,
    brevoKeyLength: process.env.BREVO_API_KEY?.length,
    appUrlExists: !!process.env.NEXT_PUBLIC_APP_URL,
  });
}