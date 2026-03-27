import { render, screen, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { VirtualList } from './VirtualList'

// Mock ResizeObserver — stores callback so we can trigger it manually
let resizeCallback: ResizeObserverCallback | null = null
beforeAll(() => {
  global.ResizeObserver = class {
    constructor (cb: ResizeObserverCallback) {
      resizeCallback = cb
    }

    observe () {}
    unobserve () {}
    disconnect () {}
  }
})

function simulateContainerHeight (height: number) {
  act(() => {
    resizeCallback?.(
      [{ contentRect: { height } } as unknown as ResizeObserverEntry],
      {} as ResizeObserver
    )
  })
}

function makeRenderItem () {
  return jest.fn(
    (index: number, _onToggle: (i: number) => void, _isExpanded: boolean) => (
      <div data-testid={`item-${index}`}>Item {index}</div>
    )
  )
}

describe('VirtualList', () => {
  it('renders only visible items plus overscan, not all items', () => {
    const renderItem = makeRenderItem()
    render(
      <VirtualList
        itemCount={1000}
        defaultItemHeight={40}
        renderItem={renderItem}
      />
    )
    simulateContainerHeight(500)

    // 500px / 40px = 12.5 visible + 5 overscan = ~18 items
    expect(screen.getByTestId('item-0')).toBeInTheDocument()
    expect(screen.getByTestId('item-17')).toBeInTheDocument()
    expect(screen.queryByTestId('item-100')).not.toBeInTheDocument()
    expect(screen.queryByTestId('item-999')).not.toBeInTheDocument()
  })

  it('renders nothing when itemCount is 0', () => {
    const renderItem = makeRenderItem()
    render(
      <VirtualList
        itemCount={0}
        defaultItemHeight={40}
        renderItem={renderItem}
      />
    )
    simulateContainerHeight(500)

    expect(screen.queryByTestId('item-0')).not.toBeInTheDocument()
  })

  it('renders all items when list fits in viewport', () => {
    const renderItem = makeRenderItem()
    render(
      <VirtualList
        itemCount={5}
        defaultItemHeight={40}
        renderItem={renderItem}
      />
    )
    simulateContainerHeight(500)

    for (let i = 0; i < 5; i++) {
      expect(screen.getByTestId(`item-${i}`)).toBeInTheDocument()
    }
  })

  it('renders fewer visible items with larger defaultItemHeight', () => {
    const renderItem = makeRenderItem()
    render(
      <VirtualList
        itemCount={100}
        defaultItemHeight={100}
        renderItem={renderItem}
      />
    )
    simulateContainerHeight(500)

    // 500/100 = 5 visible + 5 overscan = items 0..9
    expect(screen.getByTestId('item-0')).toBeInTheDocument()
    expect(screen.getByTestId('item-9')).toBeInTheDocument()
    expect(screen.queryByTestId('item-20')).not.toBeInTheDocument()
  })

  it('creates a spacer div with height = itemCount * defaultItemHeight', () => {
    const renderItem = makeRenderItem()
    const { container } = render(
      <VirtualList
        itemCount={1000}
        defaultItemHeight={40}
        renderItem={renderItem}
      />
    )
    simulateContainerHeight(500)

    const spacer = container.querySelector('[class*="spacer"]') as HTMLElement
    expect(spacer).toBeInTheDocument()
    expect(spacer.style.height).toBe('40000px')
  })

  it('positions items absolutely with translateY', () => {
    const renderItem = makeRenderItem()
    const { container } = render(
      <VirtualList
        itemCount={100}
        defaultItemHeight={40}
        renderItem={renderItem}
      />
    )
    simulateContainerHeight(500)

    const firstWrapper = container.querySelector('[style*="translateY(0px)"]')
    expect(firstWrapper).toBeInTheDocument()

    const secondWrapper = container.querySelector('[style*="translateY(40px)"]')
    expect(secondWrapper).toBeInTheDocument()
  })

  it('passes isExpanded=false and a toggle function to renderItem', () => {
    const renderItem = makeRenderItem()
    render(
      <VirtualList
        itemCount={10}
        defaultItemHeight={40}
        renderItem={renderItem}
      />
    )
    simulateContainerHeight(500)

    expect(renderItem).toHaveBeenCalled()
    const [index, onToggle, isExpanded] = renderItem.mock.calls[0]
    expect(index).toBe(0)
    expect(typeof onToggle).toBe('function')
    expect(isExpanded).toBe(false)
  })

  it('toggles expand state when onToggle is called', () => {
    const renderItem = makeRenderItem()
    render(
      <VirtualList
        itemCount={10}
        defaultItemHeight={40}
        renderItem={renderItem}
      />
    )
    simulateContainerHeight(500)

    const onToggle = renderItem.mock.calls[0][1]
    renderItem.mockClear()

    act(() => {
      onToggle(2)
    })

    // renderItem should now be called with isExpanded=true for index 2
    const call = renderItem.mock.calls.find(
      (args: unknown[]) => args[0] === 2
    )
    expect(call).toBeDefined()
    expect(call![2]).toBe(true)
  })

  it('renders zero items before ResizeObserver fires (viewportHeight=0)', () => {
    const renderItem = makeRenderItem()
    render(
      <VirtualList
        itemCount={1000}
        defaultItemHeight={40}
        renderItem={renderItem}
      />
    )

    // Do NOT call simulateContainerHeight — viewportHeight stays 0
    expect(renderItem).not.toHaveBeenCalled()
  })

  it('adjusts spacer height when a row is expanded', () => {
    const renderItem = makeRenderItem()
    const { container } = render(
      <VirtualList
        itemCount={100}
        defaultItemHeight={40}
        renderItem={renderItem}
      />
    )
    simulateContainerHeight(500)

    const spacer = container.querySelector('[class*="spacer"]') as HTMLElement
    expect(spacer.style.height).toBe('4000px')

    // Expand row 0
    const onToggle = renderItem.mock.calls[0][1]
    act(() => {
      onToggle(0)
    })

    // 100 * 40 + 1 * (300 - 40) = 4260
    expect(spacer.style.height).toBe('4260px')
  })
})
