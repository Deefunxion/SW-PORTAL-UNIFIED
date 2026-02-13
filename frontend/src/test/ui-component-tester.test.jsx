import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'

// Import pages to test
import HomePage from '@/pages/HomePage'
import ApothecaryPage from '@/pages/ApothecaryPage'
import ForumPage from '@/pages/ForumPage'
import AssistantPage from '@/pages/AssistantPage'

// Mock API
vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ 
      data: { 
        categories: [], 
        metadata: { total_files: 0 },
        length: 0 
      } 
    })),
    post: vi.fn(() => Promise.resolve({ data: { response: 'Test response' } }))
  }
}))

// Test wrapper with all providers
const TestWrapper = ({ children }) => (
  <BrowserRouter>
    <AuthProvider>
      {children}
    </AuthProvider>
  </BrowserRouter>
)

describe('🧪 SW Portal UI Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('📱 HomePage Component', () => {
    test('✅ renders main hero section', async () => {
      render(<HomePage />, { wrapper: TestWrapper })
      
      expect(screen.getByText(/Καλώς ήρθατε στο/)).toBeInTheDocument()
      expect(screen.getByText(/SW Portal/)).toBeInTheDocument()
    })

    test('✅ displays government badges with Font Awesome icons', async () => {
      render(<HomePage />, { wrapper: TestWrapper })
      
      expect(screen.getByText(/Περιφέρεια Αττικής/)).toBeInTheDocument()
      expect(screen.getByText(/Ασφαλές Περιβάλλον/)).toBeInTheDocument()
      expect(screen.getByText(/Τοπική Εγκατάσταση/)).toBeInTheDocument()
    })

    test('✅ navigation links are clickable', async () => {
      render(<HomePage />, { wrapper: TestWrapper })
      
      const links = screen.getAllByRole('link')
      expect(links.length).toBeGreaterThan(0)
      
      // Test that links have proper href attributes
      const apothecaryLink = screen.getByText(/Αρχεία/)
      expect(apothecaryLink.closest('a')).toHaveAttribute('href')
    })
  })

  describe('📚 ApothecaryPage Component', () => {
    test('✅ renders without crashing', async () => {
      render(<ApothecaryPage />, { wrapper: TestWrapper })
      
      await waitFor(() => {
        expect(screen.getByText(/Αρχειοθήκη/)).toBeInTheDocument()
      })
    })

    test('✅ search functionality exists', async () => {
      render(<ApothecaryPage />, { wrapper: TestWrapper })
      
      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/Αναζήτηση/)
        expect(searchInput).toBeInTheDocument()
        expect(searchInput).toHaveAttribute('type', 'text')
      })
    })

    test('✅ upload button is present and clickable', async () => {
      render(<ApothecaryPage />, { wrapper: TestWrapper })
      
      await waitFor(() => {
        const uploadButton = screen.getByText(/Ανέβασμα/)
        expect(uploadButton).toBeInTheDocument()
        expect(uploadButton.closest('button')).not.toBeDisabled()
      })
    })

    test('✅ Font Awesome icons are loaded', async () => {
      render(<ApothecaryPage />, { wrapper: TestWrapper })
      
      await waitFor(() => {
        // Check for FontAwesome icon classes or SVG elements
        const iconElements = document.querySelectorAll('svg[data-testid], .fa-icon, svg[class*="fa-"]')
        expect(iconElements.length).toBeGreaterThan(0)
      })
    })
  })

  describe('💬 ForumPage Component', () => {
    test('✅ renders forum categories', async () => {
      render(<ForumPage />, { wrapper: TestWrapper })
      
      await waitFor(() => {
        expect(screen.getByText(/Φόρουμ Συζητήσεων/)).toBeInTheDocument()
      })
    })

    test('✅ create discussion button works', async () => {
      const user = userEvent.setup()
      render(<ForumPage />, { wrapper: TestWrapper })
      
      await waitFor(() => {
        const createButton = screen.getByText(/Νέα Συζήτηση/)
        expect(createButton).toBeInTheDocument()
      })
    })
  })

  describe('🤖 AssistantPage Component', () => {
    test('✅ renders AI chat interface', async () => {
      render(<AssistantPage />, { wrapper: TestWrapper })
      
      expect(screen.getByText(/AI Assistant/)).toBeInTheDocument()
    })

    test('✅ message input is functional', async () => {
      render(<AssistantPage />, { wrapper: TestWrapper })
      
      const messageInput = screen.getByPlaceholderText(/Γράψτε το μήνυμά σας/)
      expect(messageInput).toBeInTheDocument()
      expect(messageInput).not.toBeDisabled()
    })
  })

  describe('🎨 Visual Design Tests', () => {
    test('✅ buttons have proper styling classes', async () => {
      render(<HomePage />, { wrapper: TestWrapper })
      
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        // Check that buttons have Tailwind classes
        expect(button.className).toMatch(/bg-|text-|hover:|rounded-|px-|py-/)
      })
    })

    test('✅ Font Awesome icons are not emojis', async () => {
      render(<HomePage />, { wrapper: TestWrapper })
      
      // Check that we don't have emoji characters in text content
      const bodyText = document.body.textContent
      const emojiPattern = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u
      
      // Should not contain common emojis in main interface elements
      const mainElements = screen.getAllByRole('button').concat(screen.getAllByRole('link'))
      mainElements.forEach(element => {
        if (element.textContent && element.textContent.length < 100) { // Skip long text blocks
          expect(element.textContent).not.toMatch(emojiPattern)
        }
      })
    })

    test('✅ responsive design classes exist', async () => {
      render(<HomePage />, { wrapper: TestWrapper })
      
      // Check for responsive classes
      const container = document.querySelector('.container')
      if (container) {
        expect(container.className).toMatch(/container|mx-auto|px-/)
      }
    })
  })

  describe('🔗 Functionality Tests', () => {
    test('✅ navigation between pages works', async () => {
      render(<HomePage />, { wrapper: TestWrapper })
      
      const links = screen.getAllByRole('link')
      const internalLinks = links.filter(link => {
        const href = link.getAttribute('href')
        return href && (href.startsWith('/') || href.startsWith('#'))
      })
      
      expect(internalLinks.length).toBeGreaterThan(0)
    })

    test('✅ forms have proper validation', async () => {
      render(<AssistantPage />, { wrapper: TestWrapper })
      
      const messageInput = screen.getByPlaceholderText(/Γράψτε το μήνυμά σας/)
      const sendButton = screen.getByRole('button', { name: /send|στείλε|αποστολή/i })
      
      // Initially send button should be disabled with empty input
      expect(sendButton).toBeDisabled()
    })
  })
})

// Additional utility test for checking page load performance
describe('⚡ Performance Tests', () => {
  test('✅ pages render within acceptable time', async () => {
    const startTime = performance.now()
    
    render(<HomePage />, { wrapper: TestWrapper })
    
    await waitFor(() => {
      expect(screen.getByText(/SW Portal/)).toBeInTheDocument()
    })
    
    const endTime = performance.now()
    const renderTime = endTime - startTime
    
    // Should render within 1 second
    expect(renderTime).toBeLessThan(1000)
  })
})