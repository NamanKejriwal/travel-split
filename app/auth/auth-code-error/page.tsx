import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

export default function AuthCodeError() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-zinc-900">
            Authentication Error
          </CardTitle>
          <CardDescription>
            Sorry, we couldn't complete your sign in. This might happen if:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="list-disc list-inside space-y-2 text-sm text-zinc-600">
            <li>The authentication link expired</li>
            <li>You denied permission to the app</li>
            <li>There was a network issue</li>
          </ul>
          <div className="pt-4">
            <Link href="/" className="block">
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                Back to Home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}