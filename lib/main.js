const { CompositeDisposable, Disposable } = require("atom");

module.exports = {
  activate() {
    this.service = null;
    // Layers handed over by the marker hub, keyed by editor. The hub builds
    // exactly one layer per editor, so an editor maps to a single layer.
    this.layers = new Map();
    this.disposables = new CompositeDisposable(
      // Both answers are the same for every editor, so they are subscribed
      // once per package here instead of once per editor.
      atom.config.observe("marker-search-panel.permanent", (value) => {
        this.permanent = value;
        this.updateAllLayers();
      }),
      atom.workspace.onDidChangeActiveTextEditor(() => this.updateAllLayers()),
    );
  },

  deactivate() {
    this.service = null;
    this.layers.clear();
    this.disposables.dispose();
  },

  updateAllLayers() {
    for (const layer of this.layers.values()) {
      layer.update();
    }
  },

  consumeSearchControl(service) {
    this.service = service;
    const subscriptions = new CompositeDisposable(
      service.onDidUpdate(() => this.updateAllLayers()),
      service.onDidChangeFindVisibility(() => this.updateAllLayers()),
    );
    this.updateAllLayers();
    return new Disposable(() => {
      this.service = null;
      subscriptions.dispose();
      this.updateAllLayers();
    });
  },

  provideMarkerLayer() {
    return {
      name: "search-panel",
      description: "Search panel result markers",
      merge: true,
      threshold: "marker-search-panel.threshold",
      initialize: (layer) => {
        this.layers.set(layer.editor, layer);
        layer.disposables.add(new Disposable(() => this.layers.delete(layer.editor)));
      },
      getItems: ({ editor }) => {
        if (!this.service) {
          return [];
        }
        if (editor !== atom.workspace.getActiveTextEditor()) {
          return [];
        }
        if (!this.permanent && !this.service.isFindVisible()) {
          return [];
        }
        const markerLayer = this.service.resultsMarkerLayerForTextEditor(editor);
        if (!markerLayer) {
          return [];
        }
        return markerLayer.getMarkers().map((marker) => {
          const range = marker.getScreenRange();
          return { row: range.start.row, end: range.end.row };
        });
      },
    };
  },
};
