# scrollmap-search-panel

Show search results on the scrollbar.

A layer package for [scrollmap](https://github.com/lumine-code/scrollmap).

## Features

- **Result markers**: shows every search result of the active editor on the scrollbar.
- **Range merging**: adjacent result rows are merged into a single marker.
- **Threshold**: hides markers when the result count exceeds a configurable limit.
- **Permanent view**: optionally keeps markers visible after the find panel is closed.

## Installation

To install `scrollmap-search-panel` search for _scrollmap-search-panel_ in the Install pane of the Lumine settings or run `lumine --install lumine-code/scrollmap-search-panel`.

## Customization

The marker style can be adjusted in the `styles.less` file, e.g. change the marker color:

```less
.scrollmap .marker.marker-find {
  background-color: var(--text-color-info);
}
```

## Services

- **scrollmap** (`1.0.0`): provided to render search result markers as a layer on the editor scrollbar.
- **search-panel** (`^1.0.0`): consumed to observe search updates, panel visibility, and the results marker layer of each editor.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
