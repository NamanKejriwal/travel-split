import { toast } from 'sonner'
import { PostgrestError } from '@supabase/supabase-js'

// 🎯 User-friendly error messages
const ERROR_MESSAGES: Record<string, string> = {
  // Network errors
  'Failed to fetch': 'No internet connection. Please check your network.',
  'NetworkError': 'Connection lost. Please try again.',
  'TimeoutError': 'Request took too long. Please try again.',
  
  // Auth errors
  'Invalid login credentials': 'Wrong email or password. Please try again.',
  'Email not confirmed': 'Please verify your email before signing in.',
  'User already registered': 'This email is already in use.',
  'Invalid email': 'Please enter a valid email address.',
  'Password should be at least 6 characters': 'Password must be at least 6 characters.',
  
  // Permission errors
  '401': 'Please log in to continue.',
  '403': 'You don\'t have permission to do that.',
  '404': 'Not found. This item may have been deleted.',
  
  // Database errors
  'unique constraint': 'This already exists. Please use a different value.',
  'foreign key constraint': 'Cannot delete - other items depend on this.',
  'not-null constraint': 'Please fill in all required fields.',
  
  // Supabase-specific
  'JWT expired': 'Your session expired. Please log in again.',
  'row-level security': 'You don\'t have access to this data.',
  
  // Generic
  'default': 'Something went wrong. Please try again.',
}

// 🔍 Get user-friendly error message
function getFriendlyMessage(error: any): string {
  const errorStr = error?.message || error?.toString() || ''
  
  // Check each known error pattern
  for (const [pattern, message] of Object.entries(ERROR_MESSAGES)) {
    if (errorStr.toLowerCase().includes(pattern.toLowerCase())) {
      return message
    }
  }
  
  // Check HTTP status codes
  if (error?.status) {
    return ERROR_MESSAGES[error.status.toString()] || ERROR_MESSAGES.default
  }
  
  return ERROR_MESSAGES.default
}

// 🎨 Error type detection
type ErrorType = 
  | 'network' 
  | 'auth' 
  | 'permission' 
  | 'validation' 
  | 'database' 
  | 'unknown'

function getErrorType(error: any): ErrorType {
  const errorStr = error?.message?.toLowerCase() || ''
  
  if (errorStr.includes('fetch') || errorStr.includes('network')) {
    return 'network'
  }
  if (errorStr.includes('auth') || errorStr.includes('login') || errorStr.includes('jwt')) {
    return 'auth'
  }
  if (error?.status === 403 || errorStr.includes('permission') || errorStr.includes('security')) {
    return 'permission'
  }
  if (errorStr.includes('constraint') || errorStr.includes('required')) {
    return 'validation'
  }
  if (error instanceof PostgrestError) {
    return 'database'
  }
  
  return 'unknown'
}

// 🎯 Main error handler
export function handleError(
  error: any,
  context?: {
    action?: string // What was the user trying to do?
    fallback?: () => void // Fallback action
    retry?: () => void // Retry function
    silent?: boolean // Don't show toast
  }
) {
  const errorType = getErrorType(error)
  const friendlyMessage = getFriendlyMessage(error)
  const actionContext = context?.action ? ` while ${context.action}` : ''
  
  // 📊 Log to console (and analytics if available)
  console.error(`[${errorType}]${actionContext}:`, error)
  
  if (typeof window !== 'undefined' && (window as any).trackEvent) {
    (window as any).trackEvent.error(
      errorType,
      error?.message || 'Unknown error',
      context?.action || 'unknown'
    )
  }
  
  // 🔕 Silent mode (for background operations)
  if (context?.silent) {
    return { type: errorType, message: friendlyMessage }
  }
  
  // 📢 Show user-friendly toast
  const toastOptions: any = {
    duration: errorType === 'network' ? 10000 : 5000,
  }
  
  // Add action buttons based on error type
  if (context?.retry && errorType === 'network') {
    toastOptions.action = {
      label: 'Retry',
      onClick: context.retry,
    }
  }
  
  if (context?.fallback) {
    toastOptions.action = {
      label: 'Undo',
      onClick: context.fallback,
    }
  }
  
  toast.error(friendlyMessage, toastOptions)
  
  return { type: errorType, message: friendlyMessage }
}

// 🔄 Retry helper with exponential backoff
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number
    delayMs?: number
    onRetry?: (attempt: number) => void
  } = {}
): Promise<T> {
  const { maxRetries = 3, delayMs = 1000, onRetry } = options
  
  let lastError: any
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = delayMs * Math.pow(2, attempt - 1)
        
        console.log(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms`)
        
        if (onRetry) {
          onRetry(attempt)
        }
        
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError
}

// 🎯 Usage wrapper for async operations
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context?: {
    action?: string
    retry?: boolean
    silent?: boolean
  }
): Promise<T | null> {
  try {
    if (context?.retry) {
      return await retryOperation(operation, {
        maxRetries: 3,
        onRetry: (attempt) => {
          if (!context.silent) {
            toast.loading(`Retrying... (attempt ${attempt}/3)`, {
              duration: 1000,
            })
          }
        },
      })
    }
    
    return await operation()
  } catch (error) {
    handleError(error, {
      action: context?.action,
      silent: context?.silent,
      retry: context?.retry ? operation : undefined,
    })
    return null
  }
}

// 🎬 USAGE EXAMPLES:
/*
// Simple error handling:
try {
  await supabase.from('expenses').insert(expense)
} catch (error) {
  handleError(error, { action: 'adding expense' })
}

// With retry:
const result = await withErrorHandling(
  () => supabase.from('expenses').insert(expense),
  { action: 'adding expense', retry: true }
)

// With fallback:
handleError(error, {
  action: 'deleting expense',
  fallback: () => setExpenses(previousExpenses)
})
*/