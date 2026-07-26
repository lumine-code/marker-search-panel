const { CompositeDisposable, Disposable } = require("atom");

module.exports = {
  activate() {
    this.disposables = new CompositeDisposable(
      atom.config.observe("scrollmap-search-panel.permanent", (value) => {
        this.permanent = value;
      }),
    );
    this.service = null;
    // Layers handed over by the scrollmap hub, keyed by editor.
    this.layers = new Map();
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

  provideScrollmapLayer() {
    return {
      name: "search-panel",
      description: "Search panel result markers",
      merge: true,
      threshold: "scrollmap-search-panel.threshold",
      initialize: (layer) => {
        this.layers.set(layer.editor, layer);
        layer.disposables.add(
          new Disposable(() => this.layers.delete(layer.editor)),
          atom.config.onDidChange("scrollmap-search-panel.permanent", layer.update),
          atom.workspace.onDidChangeActiveTextEditor(layer.update),
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
