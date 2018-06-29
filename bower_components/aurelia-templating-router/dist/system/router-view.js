System.register(['aurelia-dependency-injection', 'aurelia-templating', 'aurelia-router', 'aurelia-metadata'], function (_export) {
  'use strict';

  var Container, inject, ViewSlot, ViewStrategy, customElement, noView, BehaviorInstruction, Router, Origin, RouterView;

  function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

  return {
    setters: [function (_aureliaDependencyInjection) {
      Container = _aureliaDependencyInjection.Container;
      inject = _aureliaDependencyInjection.inject;
    }, function (_aureliaTemplating) {
      ViewSlot = _aureliaTemplating.ViewSlot;
      ViewStrategy = _aureliaTemplating.ViewStrategy;
      customElement = _aureliaTemplating.customElement;
      noView = _aureliaTemplating.noView;
      BehaviorInstruction = _aureliaTemplating.BehaviorInstruction;
    }, function (_aureliaRouter) {
      Router = _aureliaRouter.Router;
    }, function (_aureliaMetadata) {
      Origin = _aureliaMetadata.Origin;
    }],
    execute: function () {
      RouterView = (function () {
        function RouterView(element, container, viewSlot, router) {
          _classCallCheck(this, _RouterView);

          this.element = element;
          this.container = container;
          this.viewSlot = viewSlot;
          this.router = router;
          this.router.registerViewPort(this, this.element.getAttribute('name'));
        }

        RouterView.prototype.bind = function bind(bindingContext) {
          this.container.viewModel = bindingContext;
        };

        RouterView.prototype.process = function process(viewPortInstruction, waitToSwap) {
          var _this = this;

          var component = viewPortInstruction.component;
          var viewStrategy = component.view;
          var childContainer = component.childContainer;
          var viewModel = component.bindingContext;
          var viewModelResource = component.viewModelResource;
          var metadata = viewModelResource.metadata;

          if (!viewStrategy && 'getViewStrategy' in viewModel) {
            viewStrategy = viewModel.getViewStrategy();
          }

          if (viewStrategy) {
            viewStrategy = ViewStrategy.normalize(viewStrategy);
            viewStrategy.makeRelativeTo(Origin.get(component.router.container.viewModel.constructor).moduleId);
          }

          return metadata.load(childContainer, viewModelResource.value, viewStrategy, true).then(function (viewFactory) {
            viewPortInstruction.behavior = metadata.create(childContainer, BehaviorInstruction.dynamic(_this.element, viewModel, viewFactory));

            if (waitToSwap) {
              return;
            }

            _this.swap(viewPortInstruction);
          });
        };

        RouterView.prototype.swap = function swap(viewPortInstruction) {
          var _this2 = this;

          var removeResponse = this.viewSlot.removeAll(true);

          if (removeResponse instanceof Promise) {
            return removeResponse.then(function () {
              viewPortInstruction.behavior.view.bind(viewPortInstruction.behavior.bindingContext);
              _this2.viewSlot.add(viewPortInstruction.behavior.view);
              _this2.view = viewPortInstruction.behavior.view;
            });
          }

          viewPortInstruction.behavior.view.bind(viewPortInstruction.behavior.bindingContext);
          this.viewSlot.add(viewPortInstruction.behavior.view);
          this.view = viewPortInstruction.behavior.view;
        };

        var _RouterView = RouterView;
        RouterView = inject(Element, Container, ViewSlot, Router)(RouterView) || RouterView;
        RouterView = noView(RouterView) || RouterView;
        RouterView = customElement('router-view')(RouterView) || RouterView;
        return RouterView;
      })();

      _export('RouterView', RouterView);
    }
  };
});