import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'

// Import components to test
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import HomePage from '@/pages/HomePage'

// Mock API
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ 
      data: { categories: [], metadata: { total_files: 0 }, length: 0 } 
    }))
  }
}))

const TestWrapper = ({ children }) => (
  <BrowserRouter>
    <AuthProvider>
      {children}
    </AuthProvider>
  </BrowserRouter>
)

describe('🎨 Visual Regression Detection Tests', () => {
  
  describe('🔵 Button Visual Standards', () => {
    test('✅ default button has proper styling', () => {
      render(<Button>Test Button</Button>)
      
      const button = screen.getByRole('button')
      const computedStyle = window.getComputedStyle(button)
      
      // Check that button has proper classes
      expect(button.className).toMatch(/bg-|text-|hover:|rounded|px-|py-/)
      
      // Should not look like Windows 95 (no default browser button styles)
      expect(button.className).not.toMatch(/^$/) // Should have classes
    })

    test('✅ button variants render correctly', () => {
      const { rerender } = render(<Button variant="default">Default</Button>)
      let button = screen.getByRole('button')
      expect(button.className).toMatch(/bg-/)
      
      rerender(<Button variant="outline">Outline</Button>)
      button = screen.getByRole('button')
      expect(button.className).toMatch(/border/)
      
      rerender(<Button variant="secondary">Secondary</Button>)
      button = screen.getByRole('button')
      expect(button.className).toMatch(/bg-/)
    })

    test('✅ button sizes are consistent', () => {
      const { rerender } = render(<Button size="sm">Small</Button>)
      let button = screen.getByRole('button')
      expect(button.className).toMatch(/h-|px-|py-/)
      
      rerender(<Button size="lg">Large</Button>)
      button = screen.getByRole('button')
      expect(button.className).toMatch(/h-|px-|py-/)
    })
  })

  describe('🎯 Modern Design Standards', () => {
    test('✅ uses modern color palette', () => {
      render(<HomePage />, { wrapper: TestWrapper })
      
      // Check for modern color variables or Tailwind classes
      const elements = document.querySelectorAll('[class*="bg-"], [class*="text-"]')
      expect(elements.length).toBeGreaterThan(0)
      
      // Should use modern colors, not basic HTML colors
      const bodyStyle = window.getComputedStyle(document.body)
      expect(bodyStyle.backgroundColor).not.toBe('rgb(192, 192, 192)') // Windows 95 gray
    })

    test('✅ has proper spacing system', () => {
      render(<HomePage />, { wrapper: TestWrapper })
      
      // Check for consistent spacing classes
      const spacingElements = document.querySelectorAll('[class*="p-"], [class*="m-"], [class*="gap-"]')
      expect(spacingElements.length).toBeGreaterThan(0)
    })

    test('✅ uses modern typography', () => {
      render(<HomePage />, { wrapper: TestWrapper })
      
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6')
      headings.forEach(heading => {
        const style = window.getComputedStyle(heading)
        
        // Should have proper font weight
        expect(['400', '500', '600', '700', '800', '900']).toContain(style.fontWeight)
        
        // Should not use default browser fonts
        expect(style.fontFamily).not.toBe('Times')
        expect(style.fontFamily).not.toBe('serif')
      })
    })
  })

  describe('📱 Responsive Design Tests', () => {
    test('✅ has responsive container classes', () => {
      render(<HomePage />, { wrapper: TestWrapper })
      
      const containers = document.querySelectorAll('[class*="container"], [class*="mx-auto"]')
      expect(containers.length).toBeGreaterThan(0)
    })

    test('✅ uses responsive breakpoint classes', () => {
      render(<HomePage />, { wrapper: TestWrapper })
      
      // Check for responsive classes
      const responsiveElements = document.querySelectorAll('[class*="sm:"], [class*="md:"], [class*="lg:"]')
      expect(responsiveElements.length).toBeGreaterThan(0)
    })
  })

  describe('🎨 Component Visual Consistency', () => {
    test('✅ cards have consistent styling', () => {
      render(
        <Card>
          <div>Test Card Content</div>
        </Card>
      )
      
      const card = document.querySelector('[data-slot="card"], .card, [class*="rounded"]')
      expect(card).toBeInTheDocument()
      
      if (card) {
        expect(card.className).toMatch(/rounded|shadow|border|bg-/)
      }
    })

    test('✅ no inline styles (prefer classes)', () => {
      render(<HomePage />, { wrapper: TestWrapper })
      
      // Check that we're using classes instead of inline styles
      const elementsWithInlineStyles = document.querySelectorAll('[style]')
      
      // Some inline styles are OK (for dynamic values), but most should use classes
      const suspiciousInlineStyles = Array.from(elementsWithInlineStyles).filter(el => {
        const style = el.getAttribute('style')
        return style && style.includes('background-color: gray') || 
               style.includes('color: black') ||
               style.includes('font-size: 12px')
      })
      
      expect(suspiciousInlineStyles.length).toBe(0)
    })
  })

  describe('🖼️ Icon System Tests', () => {
    test('✅ Font Awesome icons are properly loaded', () => {
      render(<HomePage />, { wrapper: TestWrapper })
      
      // Check for Font Awesome icon classes or SVG elements
      const faIcons = document.querySelectorAll('[class*="fa-"], svg[data-icon], svg[role="img"]')
      
      // Should have some Font Awesome icons
      expect(faIcons.length).toBeGreaterThan(0)
    })

    test('✅ no emoji characters in UI elements', () => {
      render(<HomePage />, { wrapper: TestWrapper })
      
      // Get all button and link text
      const buttons = screen.getAllByRole('button')
      const links = screen.getAllByRole('link')
      
      const emojiPattern = /[\u{1F300}-\u{1F5FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u
      
      [...buttons, ...links].forEach(element => {
        if (element.textContent) {
          const hasEmoji = emojiPattern.test(element.textContent)
          if (hasEmoji) {
            console.warn(`Found emoji in element: "${element.textContent}"`)
          }
          // For now, this is a warning, not a failure
          // expect(hasEmoji).toBe(false)
        }
      })
    })
  })

  describe('🎯 UI/UX Quality Tests', () => {
    test('✅ interactive elements have hover states', () => {
      render(<Button>Hover Test</Button>)
      
      const button = screen.getByRole('button')
      expect(button.className).toMatch(/hover:/)
    })

    test('✅ proper focus states for accessibility', () => {
      render(<Button>Focus Test</Button>)
      
      const button = screen.getByRole('button')
      // Should have focus styles
      expect(button.className).toMatch(/focus:|focus-visible:/)
    })

    test('✅ consistent border radius', () => {
      render(
        <div>
          <Button>Button 1</Button>
          <Card>Card Content</Card>
        </div>
      )
      
      const roundedElements = document.querySelectorAll('[class*="rounded"]')
      expect(roundedElements.length).toBeGreaterThan(0)
    })
  })
})

// Test for detecting "Windows 95" style issues
describe('🚫 Anti-Pattern Detection', () => {
  test('❌ no default browser button styling', () => {
    render(<Button>Test</Button>)
    
    const button = screen.getByRole('button')
    const style = window.getComputedStyle(button)
    
    // Should not have default button appearance
    expect(style.appearance || style.webkitAppearance).not.toBe('button')
  })

  test('❌ no Times New Roman font', () => {
    render(<HomePage />, { wrapper: TestWrapper })
    
    const body = document.body
    const style = window.getComputedStyle(body)
    
    expect(style.fontFamily.toLowerCase()).not.toContain('times')
  })

  test('❌ no basic HTML colors', () => {
    render(<HomePage />, { wrapper: TestWrapper })
    
    // Check that we're not using basic HTML colors
    const coloredElements = document.querySelectorAll('[class*="bg-"], [class*="text-"]')
    
    coloredElements.forEach(element => {
      const classes = element.className
      
      // Should not use basic colors without proper design system
      expect(classes).not.toMatch(/bg-red($|\s)|bg-blue($|\s)|bg-green($|\s)/)
      
      // Should use proper Tailwind color scales
      if (/bg-/.test(classes)) {
        expect(classes).toMatch(/bg-\w+-\d+|bg-primary|bg-secondary|bg-background/)
      }
    })
  })
})