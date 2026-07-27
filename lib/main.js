const { CompositeDisposable, Disposable } = require("atom");

module.exports = {
  activate() {
    this.service = null;
    // Layers handed over by the renderers, keyed by editor. Each renderer builds
    // its own layer from the same descriptor, so an editor holds a set of them.
    this.layers = new Map();
    this.disposables = new CompositeDisposable(
      // Both answers are the same for every editor and every renderer, so they
      // are subscribed once here and fanned out, not once per layer.
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
    for (const layers of this.layers.values()) {
      for (const layer of layers) {
        layer.update();
      }
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
        let layers = this.layers.get(layer.editor);
        if (!layers) {
          layers = new Set();
          this.layers.set(layer.editor, layers);
        }
        layers.add(layer);
        layer.disposables.add(
          new Disposable(() => {
            layers.delete(layer);
            if (layers.size === 0) {
              this.layers.delete(layer.editor);
            }
          }),
        );
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
