// ⚡ Performance monitoring utilities

interface PerformanceMetric {
    name: string
    value: number
    timestamp: number
  }
  
  class PerformanceMonitor {
    private metrics: PerformanceMetric[] = []
    private timers: Map<string, number> = new Map()
  
    // ⏱️ Start timing an operation
    startTimer(name: string) {
      this.timers.set(name, performance.now())
    }
  
    // ⏹️ End timing and record
    endTimer(name: string) {
      const startTime = this.timers.get(name)
      if (!startTime) {
        console.warn(`Timer '${name}' was never started`)
        return 0
      }
  
      const duration = performance.now() - startTime
      this.recordMetric(name, duration)
      this.timers.delete(name)
  
      // Log slow operations (> 1 second)
      if (duration > 1000) {
        console.warn(`⚠️ Slow operation: ${name} took ${duration.toFixed(2)}ms`)
      }
  
      return duration
    }
  
    // 📊 Record a metric
    private recordMetric(name: string, value: number) {
      this.metrics.push({
        name,
        value,
        timestamp: Date.now(),
      })
  
      // Keep only last 100 metrics to avoid memory issues
      if (this.metrics.length > 100) {
        this.metrics.shift()
      }
  
      // Track in analytics if available
      if (typeof window !== 'undefined' && (window as any).analytics) {
        (window as any).analytics.track('Performance Metric', {
          metric: name,
          value: value.toFixed(2),
          unit: 'ms',
        })
      }
    }
  
    // 📈 Get average for a metric
    getAverage(name: string): number {
      const filtered = this.metrics.filter(m => m.name === name)
      if (filtered.length === 0) return 0
  
      const sum = filtered.reduce((acc, m) => acc + m.value, 0)
      return sum / filtered.length
    }
  
    // 📊 Get all metrics summary
    getSummary() {
      const summary: Record<string, { avg: number; max: number; count: number }> = {}
  
      this.metrics.forEach(metric => {
        if (!summary[metric.name]) {
          summary[metric.name] = { avg: 0, max: 0, count: 0 }
        }
  
        summary[metric.name].max = Math.max(summary[metric.name].max, metric.value)
        summary[metric.name].count++
      })
  
      // Calculate averages
      Object.keys(summary).forEach(name => {
        summary[name].avg = this.getAverage(name)
      })
  
      return summary
    }
  
    // 🧹 Clear all metrics
    clear() {
      this.metrics = []
      this.timers.clear()
    }
  
    // 📱 Track page load performance
    trackPageLoad() {
      if (typeof window === 'undefined') return
  
      // Use Navigation Timing API
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
  
      if (perfData) {
        this.recordMetric('page_load_time', perfData.loadEventEnd - perfData.fetchStart)
        this.recordMetric('dom_content_loaded', perfData.domContentLoadedEventEnd - perfData.fetchStart)
        this.recordMetric('dns_lookup', perfData.domainLookupEnd - perfData.domainLookupStart)
        this.recordMetric('tcp_connection', perfData.connectEnd - perfData.connectStart)
        this.recordMetric('server_response', perfData.responseEnd - perfData.requestStart)
      }
  
      // Track Web Vitals
      if ('PerformanceObserver' in window) {
        // Largest Contentful Paint (LCP)
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries()
          const lastEntry = entries[entries.length - 1] as any
          this.recordMetric('lcp', lastEntry.renderTime || lastEntry.loadTime)
        }).observe({ entryTypes: ['largest-contentful-paint'] })
  
        // First Input Delay (FID)
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries()
          entries.forEach((entry: any) => {
            this.recordMetric('fid', entry.processingStart - entry.startTime)
          })
        }).observe({ entryTypes: ['first-input'] })
  
        // Cumulative Layout Shift (CLS)
        let clsScore = 0
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries()
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsScore += entry.value
            }
          })
          this.recordMetric('cls', clsScore)
        }).observe({ entryTypes: ['layout-shift'] })
      }
    }
  
    // 🎯 Measure API call performance
    async measureApiCall<T>(name: string, apiCall: () => Promise<T>): Promise<T> {
      this.startTimer(`api_${name}`)
      try {
        const result = await apiCall()
        const duration = this.endTimer(`api_${name}`)
        
        // Log very slow API calls
        if (duration > 3000) {
          console.error(`🐌 Very slow API call: ${name} took ${duration.toFixed(0)}ms`)
        }
        
        return result
      } catch (error) {
        this.endTimer(`api_${name}`)
        throw error
      }
    }
  
    // 📊 Get performance score (0-100)
    getPerformanceScore(): number {
      const summary = this.getSummary()
      
      // Scoring criteria (lower is better)
      const scores = {
        page_load_time: this.scoreMetric(summary.page_load_time?.avg, 1000, 3000), // Good: <1s, Bad: >3s
        lcp: this.scoreMetric(summary.lcp?.avg, 2500, 4000), // Good: <2.5s, Bad: >4s
        fid: this.scoreMetric(summary.fid?.avg, 100, 300), // Good: <100ms, Bad: >300ms
        cls: this.scoreMetric(summary.cls?.avg, 0.1, 0.25), // Good: <0.1, Bad: >0.25
      }
  
      // Average all scores
      const validScores = Object.values(scores).filter(s => !isNaN(s))
      if (validScores.length === 0) return 0
  
      return Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
    }
  
    private scoreMetric(value: number | undefined, good: number, bad: number): number {
      if (!value) return 0
      if (value <= good) return 100
      if (value >= bad) return 0
      return Math.round(100 - ((value - good) / (bad - good)) * 100)
    }
  }
  
  // Singleton instance
  export const performanceMonitor = new PerformanceMonitor()
  
  // 🎬 Auto-track page loads
  if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
      performanceMonitor.trackPageLoad()
    })
  }
  
  // 🎯 USAGE EXAMPLES:
  /*
  // Time a function:
  performanceMonitor.startTimer('fetchExpenses')
  const expenses = await fetchExpenses()
  performanceMonitor.endTimer('fetchExpenses')
  
  // Or use helper:
  const expenses = await performanceMonitor.measureApiCall(
    'fetchExpenses',
    () => supabase.from('expenses').select('*')
  )
  
  // Get performance summary:
  const summary = performanceMonitor.getSummary()
  console.log('Average API calls:', summary.api_fetchExpenses?.avg, 'ms')
  
  // Get overall score:
  const score = performanceMonitor.getPerformanceScore()
  console.log('Performance score:', score, '/100')
  */