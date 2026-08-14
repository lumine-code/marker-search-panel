# marker-search-panel

Show search results on the scrollbar and minimap.

A marker layer package for [scrollmap](https://github.com/lumine-code/scrollmap) and [minimap](https://github.com/lumine-code/minimap).

## Features

- **Result markers**: shows every search result of the active editor on both maps.
- **Range merging**: adjacent result rows are merged into a single marker.
- **Threshold**: hides markers when the result count exceeds a configurable limit.
- **Permanent view**: optionally keeps markers visible after the find panel is closed.

## Installation

To install `marker-search-panel` search for it in the Install pane of the Lumine settings, or run the command `lumine --install lumine-code/marker-search-panel`.

## Customization

The marker style can be adjusted in the `styles.css` file, e.g. change the marker color:

```css
.marker.marker-search-panel {
  background-color: var(--text-color-info);
}
```

## Services

- `marker.layer`: provided to render search result markers as a layer on the editor's overview maps.
- `search.control`: consumed to observe search updates, panel visibility, and the results marker layer of each editor.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
