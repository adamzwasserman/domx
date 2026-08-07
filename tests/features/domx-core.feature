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
  # observe() - Mutation relevance (which mutations are worth waking for)
  # ============================================================================

  Scenario: observe() ignores class-only mutations when no entry reads class
    Given the DOM contains '<button data-sort-dir="asc">Sort</button>'
    And a manifest with sortDir using selector "[data-sort-dir]" and read "attr:data-sort-dir"
    And I call observe(manifest, callback)
    When the class of "[data-sort-dir]" changes to "highlighted"
    Then callback should not be called

  Scenario: observe() fires on class mutations when an entry reads class outright
    Given the DOM contains '<button class="idle">Sort</button>'
    And a manifest with mode using selector "button" and read "attr:class"
    And I call observe(manifest, callback)
    When the class of "button" changes to "active"
    Then callback should be called with state containing mode equal to "active"

  Scenario: observe() ignores attributes outside the manifest's read set
    Given the DOM contains '<button data-sort-dir="asc">Sort</button>'
    And a manifest with sortDir using selector "[data-sort-dir]" and read "attr:data-sort-dir"
    And I call observe(manifest, callback)
    When the attribute "aria-busy" of "[data-sort-dir]" is set to "true"
    Then callback should not be called

  Scenario: observe() still fires on the exact attribute the manifest reads
    Given the DOM contains '<button data-sort-dir="asc">Sort</button>'
    And a manifest with sortDir using selector "[data-sort-dir]" and read "attr:data-sort-dir"
    And I call observe(manifest, callback)
    When the attribute "data-sort-dir" of "[data-sort-dir]" is set to "desc"
    Then callback should be called with state containing sortDir equal to "desc"

  Scenario: observe() maps a "data:name" read to its kebab-case attribute
    Given the DOM contains '<div data-sort-dir="asc">Items</div>'
    And a manifest with sortDir using selector "[data-sort-dir]" and read "data:sortDir"
    And I call observe(manifest, callback)
    When the attribute "data-sort-dir" of "[data-sort-dir]" is set to "desc"
    Then callback should be called with state containing sortDir equal to "desc"

  Scenario: observe() ignores character data edits when no entry reads text
    Given the DOM contains '<div id="box" data-count="1">original</div>'
    And a manifest with count using selector "#box" and read "attr:data-count"
    And I call observe(manifest, callback)
    When the text node inside "#box" is edited to "changed"
    Then callback should not be called

  Scenario: observe() fires on character data edits when an entry reads text
    Given the DOM contains '<div id="box">original</div>'
    And a manifest with label using selector "#box" and read "text"
    And I call observe(manifest, callback)
    When the text node inside "#box" is edited to "changed"
    Then callback should be called with state containing label equal to "changed"

  # ============================================================================
  # observe() - manifest validation
  # ============================================================================

  Scenario: observe() rejects an invalid read shortcut at the call site
    Given the DOM contains '<div id="el"></div>'
    And a manifest with x using selector "#el" and read "attr:"
    When I call observe(manifest, callback)
    Then an error "Unknown read shortcut: attr:" should be raised synchronously

  Scenario: observe() skips entries missing selector or read
    Given the DOM contains '<div id="el"></div>'
    And a manifest with incomplete using selector "#el" and no read
    When I call observe(manifest, callback)
    Then no error should occur
    And the result should be an unsubscribe function

  # ============================================================================
  # Shared observer - union of subscriber needs
  # ============================================================================

  Scenario: the observer is narrowed to the attributes one manifest reads
    Given a manifest with sortDir using selector "[data-sort-dir]" and read "attr:data-sort-dir"
    When I call observe(manifest, callback)
    Then the shared observer should be given attributeFilter ["data-sort-dir"]

  Scenario: the observer unions the attributes of two concurrent subscribers
    Given a manifest with sortDir using selector "[data-sort-dir]" and read "attr:data-sort-dir"
    And a second manifest with theme using selector "[data-theme]" and read "data:theme"
    When I call observe() on both manifests
    Then the shared observer should be given attributeFilter ["data-sort-dir", "data-theme"]

  Scenario: the observer narrows again when one of two subscribers unsubscribes
    Given two active observe() subscriptions reading different attributes
    When I unsubscribe the first
    Then the shared observer should be given attributeFilter with only the second attribute

  Scenario: a raw on() subscriber widens the observer to every attribute
    Given an active observe() subscription reading only "attr:data-sort-dir"
    When I call on(callback)
    Then the shared observer should be given attributes true
    And the shared observer should be given no attributeFilter

  Scenario: the observer narrows again once the on() subscriber leaves
    Given an active observe() subscription reading only "attr:data-sort-dir"
    And an active on() subscription
    When I unsubscribe the on() subscription
    Then the shared observer should be given attributeFilter ["data-sort-dir"]

  Scenario: a custom read function widens the observer to every attribute
    Given a manifest with combined using selector "#thing" and read a custom function
    When I call observe(manifest, callback)
    Then the shared observer should be given attributes true
    And the shared observer should be given no attributeFilter

  Scenario: a value-only manifest leaves attributes off entirely
    Given a manifest with searchQuery using selector "#search" and read "value"
    When I call observe(manifest, callback)
    Then the shared observer should be given no attributes
    And the shared observer should be given no attributeFilter

  Scenario: characterData is requested only when a manifest reads text
    Given a manifest with sortDir using selector "[data-sort-dir]" and read "attr:data-sort-dir"
    When I call observe(manifest, callback)
    Then the shared observer should be given characterData false
    When I also observe a manifest with label using read "text"
    Then the shared observer should be given characterData true

  Scenario: the observer disconnects when the last subscriber leaves
    Given a single active observe() subscription
    When I unsubscribe it
    Then the shared observer should be disconnected

  Scenario: recomputing the union does not double-register the target
    Given an active on() subscription
    And the DOM contains '<button data-sort-dir="asc">Sort</button>'
    When I call observe() on another manifest, recomputing the union
    And the attribute "data-sort-dir" of "button" is set to "desc"
    Then the on() callback should receive exactly one record for "data-sort-dir"

  Scenario: an attribute no manifest reads still reaches a raw on() subscriber
    Given an active observe() subscription reading only "attr:data-sort-dir"
    And an active on() subscription
    And the DOM contains '<button data-sort-dir="asc">Sort</button>'
    When the attribute "aria-busy" of "button" is set to "true"
    Then the on() callback should receive a record for "aria-busy"

  # ============================================================================
  # observe() - dx-ignore (transient nodes carry their own opt-out)
  # ============================================================================

  Scenario: observe() ignores insertion of a [dx-ignore] node
    Given the DOM contains '<div id="list" data-count="0"></div>'
    And a manifest with count using selector "#list" and read "attr:data-count"
    And I call observe(manifest, callback)
    When a node with attribute dx-ignore is appended to "#list"
    Then callback should not be called

  Scenario: observe() ignores removal of a [dx-ignore] node
    Given the DOM contains '<div id="list" data-count="0"><span dx-ignore id="ghost"></span></div>'
    And a manifest with count using selector "#list" and read "attr:data-count"
    And I call observe(manifest, callback)
    When "#ghost" is removed from "#list"
    Then callback should not be called

  Scenario: observe() ignores mutations inside a [dx-ignore] subtree
    Given the DOM contains '<div id="list" data-count="0"><span dx-ignore id="ghost" data-count="0"></span></div>'
    And a manifest with count using selector "#list" and read "attr:data-count"
    And I call observe(manifest, callback)
    When the attribute "data-count" of "#ghost" is set to "9"
    Then callback should not be called

  Scenario: observe() still fires on insertion of a node without dx-ignore
    Given the DOM contains '<div id="list" data-count="0"></div>'
    And a manifest with count using selector "#list" and read "attr:data-count"
    And I call observe(manifest, callback)
    When a node without attribute dx-ignore is appended to "#list"
    Then callback should be called

  # ============================================================================
  # observe() - server-owned state (the wipe race)
  # ============================================================================

  Scenario: observe() does not self-trigger on a serverOwned entry's own mutation
    Given the DOM contains '<div id="chips" data-chips="a">a</div>'
    And a manifest with chips using selector "#chips" and read "attr:data-chips" and serverOwned true
    And I call observe(manifest, callback)
    When the attribute "data-chips" of "#chips" is set to "a,b"
    Then callback should not be called

  Scenario: observe() still fires on user input to a serverOwned entry
    Given the DOM contains '<input id="search" value="initial">'
    And a manifest with searchQuery using selector "#search" and read "value" and serverOwned true
    And I call observe(manifest, callback)
    When the user types "typed" into "#search"
    Then callback should be called with state containing searchQuery equal to "typed"

  Scenario: collect() still reads serverOwned entries
    Given the DOM contains '<div id="chips" data-chips="a,b">chips</div>'
    And a manifest with chips using selector "#chips" and read "attr:data-chips" and serverOwned true
    When I call collect(manifest)
    Then the result should have chips equal to "a,b"

  # ============================================================================
  # Honesty laws - the manifest is the caller's, not ours (honest-test Law 3)
  # ============================================================================

  Scenario Outline: <function>() does not mutate the manifest
    Given the DOM contains a search input, a sort button, a text box and a chips div
    And a manifest reading value, attr, text and a serverOwned entry
    When I call <function>()
    Then the manifest should be unchanged

    Examples:
      | function |
      | collect  |
      | apply    |
      | observe  |

  Scenario: collect() returns the same state twice over an unchanged DOM
    Given the DOM contains a search input, a sort button, a text box and a chips div
    And a manifest reading value, attr, text and a serverOwned entry
    When I call collect(manifest) twice without touching the DOM
    Then both results should be equal

  # ============================================================================
  # Read vocabulary - adversarial rejection (honest-test Law 5)
  # ============================================================================

  Scenario Outline: collect() rejects an edit-distance-1 neighbour of a read shortcut
    Given the DOM contains '<input id="el" value="hello">'
    And a manifest with x using selector "#el" and read "<neighbour>"
    When I call collect(manifest)
    Then an error "Unknown read shortcut: <neighbour>" should be raised

    Examples:
      | neighbour |
      | Value     |
      | valu      |
      | vvalue    |
      | " value"  |
      | "value "  |
      | Checked   |
      | checke    |
      | Text      |
      | tex       |
      | attr      |
      | atr:x     |
      | Attr:x    |
      | attr:     |
      | data      |
      | dat:x     |
      | Data:x    |
      | data:     |

  Scenario Outline: apply() rejects an edit-distance-1 neighbour of a write shortcut
    Given the DOM contains '<input id="el" value="hello">'
    And a manifest with x using selector "#el" and write "<neighbour>"
    When I call apply(manifest, {x: "v"})
    Then an error "Unknown write shortcut: <neighbour>" should be raised

    Examples:
      | neighbour |
      | Value     |
      | valu      |
      | vvalue    |
      | " value"  |
      | "value "  |
      | Checked   |
      | checke    |
      | Text      |
      | tex       |
      | attr      |
      | atr:x     |
      | Attr:x    |
      | attr:     |
      | data      |
      | dat:x     |
      | Data:x    |
      | data:     |

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
