Feature: domx Core - DOM State Observer
  As a developer using DATAOS principles
  I want to collect, apply, and observe DOM state through a manifest
  So that the DOM remains the single source of truth

  Background:
    Given a DOM with test elements

  # ============================================================================
  # collect() - Read state from DOM
  # ============================================================================

  Scenario: collect() extracts single element value using "value" shortcut
    Given the DOM contains '<input id="search" value="hello">'
    And a manifest with searchQuery using selector "#search" and read "value"
    When I call collect(manifest)
    Then the result should have searchQuery equal to "hello"

  Scenario: collect() extracts checkbox state using "checked" shortcut
    Given the DOM contains '<input id="toggle" type="checkbox" checked>'
    And a manifest with isActive using selector "#toggle" and read "checked"
    When I call collect(manifest)
    Then the result should have isActive equal to true

  Scenario: collect() extracts text content using "text" shortcut
    Given the DOM contains '<span id="label">Hello World</span>'
    And a manifest with labelText using selector "#label" and read "text"
    When I call collect(manifest)
    Then the result should have labelText equal to "Hello World"

  Scenario: collect() extracts attribute using "attr:name" shortcut
    Given the DOM contains '<button data-sort-dir="asc">Sort</button>'
    And a manifest with sortDir using selector "[data-sort-dir]" and read "attr:data-sort-dir"
    When I call collect(manifest)
    Then the result should have sortDir equal to "asc"

  Scenario: collect() extracts dataset using "data:name" shortcut
    Given the DOM contains '<div data-filter="active">Items</div>'
    And a manifest with filter using selector "[data-filter]" and read "data:filter"
    When I call collect(manifest)
    Then the result should have filter equal to "active"

  Scenario: collect() uses custom extractor function
    Given the DOM contains '<div data-x="foo" data-y="bar">Combined</div>'
    And a manifest with combined using selector "div" and read function that returns dataset.x + "-" + dataset.y
    When I call collect(manifest)
    Then the result should have combined equal to "foo-bar"

  Scenario: collect() returns null for missing elements
    Given the DOM contains '<div id="exists">Here</div>'
    And a manifest with missing using selector "#nonexistent" and read "text"
    When I call collect(manifest)
    Then the result should have missing equal to null

  Scenario: collect() returns array for multiple matching elements
    Given the DOM contains '<span class="tag">A</span><span class="tag">B</span><span class="tag">C</span>'
    And a manifest with tags using selector ".tag" and read "text"
    When I call collect(manifest)
    Then the result should have tags equal to ["A", "B", "C"]

  # ============================================================================
  # apply() - Write state to DOM
  # ============================================================================

  Scenario: apply() writes value using "value" shortcut
    Given the DOM contains '<input id="search" value="old">'
    And a manifest with searchQuery using selector "#search" and write "value"
    When I call apply(manifest, {searchQuery: "new"})
    Then the element "#search" should have value "new"

  Scenario: apply() writes checked state using "checked" shortcut
    Given the DOM contains '<input id="toggle" type="checkbox">'
    And a manifest with isActive using selector "#toggle" and write "checked"
    When I call apply(manifest, {isActive: true})
    Then the element "#toggle" should have checked equal to true

  Scenario: apply() writes text content using "text" shortcut
    Given the DOM contains '<span id="label">Old</span>'
    And a manifest with labelText using selector "#label" and write "text"
    When I call apply(manifest, {labelText: "New"})
    Then the element "#label" should have textContent "New"

  Scenario: apply() writes attribute using "attr:name" shortcut
    Given the DOM contains '<button data-sort-dir="asc">Sort</button>'
    And a manifest with sortDir using selector "[data-sort-dir]" and write "attr:data-sort-dir"
    When I call apply(manifest, {sortDir: "desc"})
    Then the element "[data-sort-dir]" should have attribute "data-sort-dir" equal to "desc"

  Scenario: apply() writes dataset using "data:name" shortcut
    Given the DOM contains '<div data-filter="old">Items</div>'
    And a manifest with filter using selector "[data-filter]" and write "data:filter"
    When I call apply(manifest, {filter: "completed"})
    Then the element "[data-filter]" should have dataset.filter equal to "completed"

  Scenario: apply() uses custom writer function
    Given the DOM contains '<div data-x="" data-y="">Combined</div>'
    And a manifest with combined using selector "div" and write function that splits value and sets dataset.x and dataset.y
    When I call apply(manifest, {combined: "foo-bar"})
    Then the element "div" should have dataset.x equal to "foo"
    And the element "div" should have dataset.y equal to "bar"

  Scenario: apply() ignores keys not in manifest
    Given the DOM contains '<input id="search" value="keep">'
    And a manifest with searchQuery using selector "#search" and write "value"
    When I call apply(manifest, {unknownKey: "ignored", searchQuery: "updated"})
    Then the element "#search" should have value "updated"
    And no errors should occur

  Scenario: apply() only processes entries with write key
    Given the DOM contains '<input id="readonly" value="original">'
    And a manifest with readOnly using selector "#readonly" and read "value" but no write
    When I call apply(manifest, {readOnly: "attempted"})
    Then the element "#readonly" should have value "original"

  # ============================================================================
  # observe() - Watch DOM for state changes
  # ============================================================================

  Scenario: observe() calls callback on input event for "value" read type
    Given the DOM contains '<input id="search" value="initial">'
    And a manifest with searchQuery using selector "#search" and read "value"
    And I call observe(manifest, callback)
    When the user types "updated" into "#search"
    Then callback should be called with state containing searchQuery equal to "updated"

  Scenario: observe() calls callback on change event for "checked" read type
    Given the DOM contains '<input id="toggle" type="checkbox">'
    And a manifest with isActive using selector "#toggle" and read "checked"
    And I call observe(manifest, callback)
    When the user clicks "#toggle"
    Then callback should be called with state containing isActive equal to true

  Scenario: observe() uses MutationObserver for "attr:*" read type
    Given the DOM contains '<button data-sort-dir="asc">Sort</button>'
    And a manifest with sortDir using selector "[data-sort-dir]" and read "attr:data-sort-dir"
    And I call observe(manifest, callback)
    When I programmatically set attribute "data-sort-dir" to "desc" on "[data-sort-dir]"
    Then callback should be called with state containing sortDir equal to "desc"

  Scenario: observe() uses MutationObserver for "data:*" read type
    Given the DOM contains '<div data-filter="active">Items</div>'
    And a manifest with filter using selector "[data-filter]" and read "data:filter"
    And I call observe(manifest, callback)
    When I programmatically set dataset.filter to "completed" on "[data-filter]"
    Then callback should be called with state containing filter equal to "completed"

  Scenario: observe() uses MutationObserver for "text" read type
    Given the DOM contains '<span id="label">Initial</span>'
    And a manifest with labelText using selector "#label" and read "text"
    And I call observe(manifest, callback)
    When I programmatically set textContent to "Updated" on "#label"
    Then callback should be called with state containing labelText equal to "Updated"

  Scenario: observe() returns unsubscribe function
    Given the DOM contains '<input id="search" value="initial">'
    And a manifest with searchQuery using selector "#search" and read "value"
    And I call observe(manifest, callback) and store the result as unsubscribe
    When I call unsubscribe()
    And the user types "changed" into "#search"
    Then callback should not be called after unsubscribe

  Scenario: observe() batches rapid changes using requestAnimationFrame
    Given the DOM contains '<input id="a" value="1"><input id="b" value="2">'
    And a manifest with a using selector "#a" and read "value"
    And a manifest with b using selector "#b" and read "value"
    And I call observe(manifest, callback)
    When I rapidly change "#a" to "10" and "#b" to "20" in the same frame
    Then callback should be called only once with both changes

  Scenario: observe() respects explicit watch override
    Given the DOM contains '<input id="search" value="initial">'
    And a manifest with searchQuery using selector "#search" and read "value" and watch "change"
    And I call observe(manifest, callback)
    When the user types "typed" into "#search" without blur
    Then callback should not be called
    When the user blurs "#search"
    Then callback should be called with state containing searchQuery equal to "typed"

  # ============================================================================
  # on() - Low-level mutation subscription
  # ============================================================================

  Scenario: on() calls callback with raw MutationRecords
    Given the DOM contains '<div id="container"></div>'
    And I call on(callback)
    When I append '<span>New</span>' to "#container"
    Then callback should be called with mutations array
    And mutations should contain addedNodes with the span element

  Scenario: on() returns unsubscribe function
    Given the DOM contains '<div id="container"></div>'
    And I call on(callback) and store the result as unsubscribe
    When I call unsubscribe()
    And I append '<span>New</span>' to "#container"
    Then callback should not be called after unsubscribe

  Scenario: on() supports multiple subscribers
    Given the DOM contains '<div id="container"></div>'
    And I call on(callback1)
    And I call on(callback2)
    When I append '<span>New</span>' to "#container"
    Then callback1 should be called with mutations
    And callback2 should be called with mutations

  # ============================================================================
  # send() - Fetch with state caching
  # ============================================================================

  Scenario: send() collects state and sends as POST body
    Given the DOM contains '<input id="search" value="query">'
    And a manifest with searchQuery using selector "#search" and read "value"
    And fetch is mocked to return success
    When I call send("/api/search", manifest)
    Then fetch should be called with "/api/search"
    And fetch body should contain {searchQuery: "query"}
    And fetch method should be "POST"

  Scenario: send() caches state to localStorage before fetch
    Given the DOM contains '<input id="search" value="cached">'
    And a manifest with searchQuery using selector "#search" and read "value"
    And fetch is mocked to return success
    When I call send("/api/search", manifest)
    Then localStorage["domx:lastRequest"] should contain url "/api/search"
    And localStorage["domx:lastRequest"] should contain state {searchQuery: "cached"}

  Scenario: send() passes custom headers
    Given the DOM contains '<input id="search" value="query">'
    And a manifest with searchQuery using selector "#search" and read "value"
    And fetch is mocked to return success
    When I call send("/api/search", manifest, {headers: {"X-Custom": "value"}})
    Then fetch headers should contain "X-Custom" equal to "value"

  Scenario: send() returns fetch response
    Given the DOM contains '<input id="search" value="query">'
    And a manifest with searchQuery using selector "#search" and read "value"
    And fetch is mocked to return HTML "<div>Result</div>"
    When I call send("/api/search", manifest)
    Then the result should be a Response
    And the response text should be "<div>Result</div>"

  # ============================================================================
  # replay() - Restore state on page refresh
  # ============================================================================

  Scenario: replay() re-sends cached request
    Given localStorage["domx:lastRequest"] contains url "/api/search" and state {searchQuery: "cached"}
    And fetch is mocked to return success
    When I call replay()
    Then fetch should be called with "/api/search"
    And fetch body should contain {searchQuery: "cached"}

  Scenario: replay() returns null when no cache exists
    Given localStorage["domx:lastRequest"] is empty
    When I call replay()
    Then the result should be null
    And fetch should not be called

  Scenario: replay() returns null when cache is expired
    Given localStorage["domx:lastRequest"] contains url "/api/search" and state {searchQuery: "old"} with timestamp 10 minutes ago
    When I call replay()
    Then the result should be null

  Scenario: replay() returns Response on success
    Given localStorage["domx:lastRequest"] contains url "/api/search" and state {searchQuery: "cached"}
    And fetch is mocked to return HTML "<div>Restored</div>"
    When I call replay()
    Then the result should be a Response
    And the response text should be "<div>Restored</div>"

  # ============================================================================
  # clearCache() - Manual cache management
  # ============================================================================

  Scenario: clearCache() removes cached request
    Given localStorage["domx:lastRequest"] contains url "/api/search" and state {searchQuery: "cached"}
    When I call clearCache()
    Then localStorage["domx:lastRequest"] should be empty

  # ============================================================================
  # Performance requirements
  # ============================================================================

  Scenario: collect() completes in under 5ms for 100 elements
    Given the DOM contains 100 elements with data-item attributes
    And a manifest with items using selector "[data-item]" and read "data:item"
    When I measure the time to call collect(manifest) 10 times
    Then the average time should be under 5ms

  Scenario: observe() uses single MutationObserver regardless of manifest size
    Given a manifest with 10 different selectors
    When I call observe(manifest, callback)
    Then only one MutationObserver should be created
