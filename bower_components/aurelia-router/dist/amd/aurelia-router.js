define(['exports', 'core-js', 'aurelia-logging', 'aurelia-dependency-injection', 'aurelia-route-recognizer', 'aurelia-history', 'aurelia-event-aggregator'], function (exports, _coreJs, _aureliaLogging, _aureliaDependencyInjection, _aureliaRouteRecognizer, _aureliaHistory, _aureliaEventAggregator) {
  'use strict';

  exports.__esModule = true;

  var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

  exports.createRouteFilterStep = createRouteFilterStep;
  exports.processPotential = processPotential;
  exports.normalizeAbsolutePath = normalizeAbsolutePath;
  exports.createRootedPath = createRootedPath;
  exports.resolveUrl = resolveUrl;
  exports.isNavigationCommand = isNavigationCommand;
  exports.buildNavigationPlan = buildNavigationPlan;
  exports.loadNewRoute = loadNewRoute;

  function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

  function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

  var RouteFilterContainer = (function () {
    RouteFilterContainer.inject = function inject() {
      return [_aureliaDependencyInjection.Container];
    };

    function RouteFilterContainer(container) {
      _classCallCheck(this, RouteFilterContainer);

      this.container = container;
      this.filters = {};
      this.filterCache = {};
    }

    RouteFilterContainer.prototype.addStep = function addStep(name, step) {
      var index = arguments.length <= 2 || arguments[2] === undefined ? -1 : arguments[2];

      var filter = this.filters[name];
      if (!filter) {
        filter = this.filters[name] = [];
      }

      if (index === -1) {
        index = filter.length;
      }

      filter.splice(index, 0, step);
      this.filterCache = {};
    };

    RouteFilterContainer.prototype.getFilterSteps = function getFilterSteps(name) {
      if (this.filterCache[name]) {
        return this.filterCache[name];
      }

      var steps = [];
      var filter = this.filters[name];
      if (!filter) {
        return steps;
      }

      for (var i = 0, l = filter.length; i < l; i++) {
        if (typeof filter[i] === 'string') {
          steps.push.apply(steps, this.getFilterSteps(filter[i]));
        } else {
          steps.push(this.container.get(filter[i]));
        }
      }

      this.filterCache[name] = steps;
      return steps;
    };

    return RouteFilterContainer;
  })();

  exports.RouteFilterContainer = RouteFilterContainer;

  function createRouteFilterStep(name) {
    function create(routeFilterContainer) {
      return new RouteFilterStep(name, routeFilterContainer);
    }

    create.inject = function () {
      return [RouteFilterContainer];
    };

    return create;
  }

  var RouteFilterStep = (function () {
    function RouteFilterStep(name, routeFilterContainer) {
      _classCallCheck(this, RouteFilterStep);

      this.isMultiStep = true;

      this.name = name;
      this.routeFilterContainer = routeFilterContainer;
    }

    RouteFilterStep.prototype.getSteps = function getSteps() {
      return this.routeFilterContainer.getFilterSteps(this.name);
    };

    return RouteFilterStep;
  })();

  function createResult(ctx, next) {
    return {
      status: next.status,
      context: ctx,
      output: next.output,
      completed: next.status === pipelineStatus.completed
    };
  }

  var pipelineStatus = {
    completed: 'completed',
    canceled: 'canceled',
    rejected: 'rejected',
    running: 'running'
  };

  exports.pipelineStatus = pipelineStatus;

  var Pipeline = (function () {
    function Pipeline() {
      _classCallCheck(this, Pipeline);

      this.steps = [];
    }

    Pipeline.prototype.withStep = function withStep(step) {
      var run = undefined;

      if (typeof step === 'function') {
        run = step;
      } else if (step.isMultiStep) {
        var steps = step.getSteps();
        for (var i = 0, l = steps.length; i < l; i++) {
          this.withStep(steps[i]);
        }

        return this;
      } else {
        run = step.run.bind(step);
      }

      this.steps.push(run);

      return this;
    };

    Pipeline.prototype.run = function run(ctx) {
      var index = -1;
      var steps = this.steps;

      function next() {
        index++;

        if (index < steps.length) {
          var currentStep = steps[index];

          try {
            return currentStep(ctx, next);
          } catch (e) {
            return next.reject(e);
          }
        } else {
          return next.complete();
        }
      }

      next.complete = function (output) {
        next.status = pipelineStatus.completed;
        next.output = output;
        return Promise.resolve(createResult(ctx, next));
      };

      next.cancel = function (reason) {
        next.status = pipelineStatus.canceled;
        next.output = reason;
        return Promise.resolve(createResult(ctx, next));
      };

      next.reject = function (error) {
        next.status = pipelineStatus.rejected;
        next.output = error;
        return Promise.resolve(createResult(ctx, next));
      };

      next.status = pipelineStatus.running;

      return next();
    };

    return Pipeline;
  })();

  exports.Pipeline = Pipeline;

  var NavigationInstruction = (function () {
    function NavigationInstruction(fragment, queryString, params, queryParams, config, parentInstruction) {
      _classCallCheck(this, NavigationInstruction);

      this.fragment = fragment;
      this.queryString = queryString;
      this.params = params || {};
      this.queryParams = queryParams;
      this.config = config;
      this.viewPortInstructions = {};
      this.parentInstruction = parentInstruction;

      var ancestorParams = [];
      var current = this;
      do {
        var currentParams = Object.assign({}, current.params);
        if (current.config.hasChildRouter) {
          delete currentParams[current.getWildCardName()];
        }

        ancestorParams.unshift(currentParams);
        current = current.parentInstruction;
      } while (current);

      var allParams = Object.assign.apply(Object, [{}, queryParams].concat(ancestorParams));
      this.lifecycleArgs = [allParams, config, this];
    }

    NavigationInstruction.prototype.addViewPortInstruction = function addViewPortInstruction(viewPortName, strategy, moduleId, component) {
      var viewportInstruction = this.viewPortInstructions[viewPortName] = {
        name: viewPortName,
        strategy: strategy,
        moduleId: moduleId,
        component: component,
        childRouter: component.childRouter,
        lifecycleArgs: this.lifecycleArgs.slice()
      };

      return viewportInstruction;
    };

    NavigationInstruction.prototype.getWildCardName = function getWildCardName() {
      var wildcardIndex = this.config.route.lastIndexOf('*');
      return this.config.route.substr(wildcardIndex + 1);
    };

    NavigationInstruction.prototype.getWildcardPath = function getWildcardPath() {
      var wildcardName = this.getWildCardName();
      var path = this.params[wildcardName] || '';

      if (this.queryString) {
        path += '?' + this.queryString;
      }

      return path;
    };

    NavigationInstruction.prototype.getBaseUrl = function getBaseUrl() {
      if (!this.params) {
        return this.fragment;
      }

      var wildcardName = this.getWildCardName();
      var path = this.params[wildcardName] || '';

      if (!path) {
        return this.fragment;
      }

      return this.fragment.substr(0, this.fragment.lastIndexOf(path));
    };

    return NavigationInstruction;
  })();

  exports.NavigationInstruction = NavigationInstruction;

  var NavModel = (function () {
    function NavModel(router, relativeHref) {
      _classCallCheck(this, NavModel);

      this.isActive = false;
      this.title = null;
      this.href = null;
      this.relativeHref = null;
      this.settings = {};
      this.config = null;

      this.router = router;
      this.relativeHref = relativeHref;
    }

    NavModel.prototype.setTitle = function setTitle(title) {
      this.title = title;

      if (this.isActive) {
        this.router.updateTitle();
      }
    };

    return NavModel;
  })();

  exports.NavModel = NavModel;

  function processPotential(obj, resolve, reject) {
    if (obj && typeof obj.then === 'function') {
      var dfd = obj.then(resolve);

      if (typeof dfd['catch'] === 'function') {
        return dfd['catch'](reject);
      } else if (typeof dfd.fail === 'function') {
        return dfd.fail(reject);
      }

      return dfd;
    }

    try {
      return resolve(obj);
    } catch (error) {
      return reject(error);
    }
  }

  function normalizeAbsolutePath(path, hasPushState) {
    if (!hasPushState && path[0] !== '#') {
      path = '#' + path;
    }

    return path;
  }

  function createRootedPath(fragment, baseUrl, hasPushState) {
    if (isAbsoluteUrl.test(fragment)) {
      return fragment;
    }

    var path = '';

    if (baseUrl.length && baseUrl[0] !== '/') {
      path += '/';
    }

    path += baseUrl;

    if ((!path.length || path[path.length - 1] !== '/') && fragment[0] !== '/') {
      path += '/';
    }

    if (path.length && path[path.length - 1] === '/' && fragment[0] === '/') {
      path = path.substring(0, path.length - 1);
    }

    return normalizeAbsolutePath(path + fragment, hasPushState);
  }

  function resolveUrl(fragment, baseUrl, hasPushState) {
    if (isRootedPath.test(fragment)) {
      return normalizeAbsolutePath(fragment, hasPushState);
    }

    return createRootedPath(fragment, baseUrl, hasPushState);
  }

  var isRootedPath = /^#?\//;
  var isAbsoluteUrl = /^([a-z][a-z0-9+\-.]*:)?\/\//i;

  function isNavigationCommand(obj) {
    return obj && typeof obj.navigate === 'function';
  }

  var Redirect = (function () {
    function Redirect(url) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      _classCallCheck(this, Redirect);

      this.url = url;
      this.options = Object.assign({ trigger: true, replace: true }, options);
      this.shouldContinueProcessing = false;
    }

    Redirect.prototype.setRouter = function setRouter(router) {
      this.router = router;
    };

    Redirect.prototype.navigate = function navigate(appRouter) {
      var navigatingRouter = this.options.useAppRouter ? appRouter : this.router || appRouter;
      navigatingRouter.navigate(this.url, this.options);
    };

    return Redirect;
  })();

  exports.Redirect = Redirect;

  var RouterConfiguration = (function () {
    function RouterConfiguration() {
      _classCallCheck(this, RouterConfiguration);

      this.instructions = [];
      this.options = {};
      this.pipelineSteps = [];
    }

    RouterConfiguration.prototype.addPipelineStep = function addPipelineStep(name, step) {
      this.pipelineSteps.push({ name: name, step: step });
      return this;
    };

    RouterConfiguration.prototype.map = function map(route) {
      if (Array.isArray(route)) {
        route.forEach(this.map.bind(this));
        return this;
      }

      return this.mapRoute(route);
    };

    RouterConfiguration.prototype.mapRoute = function mapRoute(config) {
      this.instructions.push(function (router) {
        var routeConfigs = [];

        if (Array.isArray(config.route)) {
          for (var i = 0, ii = config.route.length; i < ii; ++i) {
            var current = Object.assign({}, config);
            current.route = config.route[i];
            routeConfigs.push(current);
          }
        } else {
          routeConfigs.push(Object.assign({}, config));
        }

        var navModel = undefined;
        for (var i = 0, ii = routeConfigs.length; i < ii; ++i) {
          var routeConfig = routeConfigs[i];
          routeConfig.settings = routeConfig.settings || {};
          if (!navModel) {
            navModel = router.createNavModel(routeConfig);
          }

          router.addRoute(routeConfig, navModel);
        }
      });

      return this;
    };

    RouterConfiguration.prototype.mapUnknownRoutes = function mapUnknownRoutes(config) {
      this.unknownRouteConfig = config;
      return this;
    };

    RouterConfiguration.prototype.exportToRouter = function exportToRouter(router) {
      var instructions = this.instructions;
      for (var i = 0, ii = instructions.length; i < ii; ++i) {
        instructions[i](router);
      }

      if (this.title) {
        router.title = this.title;
      }

      if (this.unknownRouteConfig) {
        router.handleUnknownRoutes(this.unknownRouteConfig);
      }

      router.options = this.options;

      var pipelineSteps = this.pipelineSteps;
      if (pipelineSteps.length) {
        if (!router.isRoot) {
          throw new Error('Pipeline steps can only be added to the root router');
        }

        var filterContainer = router.container.get(RouteFilterContainer);
        for (var i = 0, ii = pipelineSteps.length; i < ii; ++i) {
          var _pipelineSteps$i = pipelineSteps[i];
          var _name = _pipelineSteps$i.name;
          var step = _pipelineSteps$i.step;

          filterContainer.addStep(_name, step);
        }
      }
    };

    return RouterConfiguration;
  })();

  exports.RouterConfiguration = RouterConfiguration;
  var activationStrategy = {
    noChange: 'no-change',
    invokeLifecycle: 'invoke-lifecycle',
    replace: 'replace'
  };

  exports.activationStrategy = activationStrategy;

  function buildNavigationPlan(navigationContext, forceLifecycleMinimum) {
    var prev = navigationContext.prevInstruction;
    var next = navigationContext.nextInstruction;
    var plan = {};

    if ('redirect' in next.config) {
      var redirectLocation = resolveUrl(next.config.redirect, getInstructionBaseUrl(next));
      if (next.queryString) {
        redirectLocation += '?' + next.queryString;
      }

      return Promise.reject(new Redirect(redirectLocation));
    }

    if (prev) {
      var newParams = hasDifferentParameterValues(prev, next);
      var pending = [];

      var _loop = function (viewPortName) {
        var prevViewPortInstruction = prev.viewPortInstructions[viewPortName];
        var nextViewPortConfig = next.config.viewPorts[viewPortName];
        var viewPortPlan = plan[viewPortName] = {
          name: viewPortName,
          config: nextViewPortConfig,
          prevComponent: prevViewPortInstruction.component,
          prevModuleId: prevViewPortInstruction.moduleId
        };

        if (prevViewPortInstruction.moduleId !== nextViewPortConfig.moduleId) {
          viewPortPlan.strategy = activationStrategy.replace;
        } else if ('determineActivationStrategy' in prevViewPortInstruction.component.bindingContext) {
          var _prevViewPortInstruction$component$bindingContext;

          viewPortPlan.strategy = (_prevViewPortInstruction$component$bindingContext = prevViewPortInstruction.component.bindingContext).determineActivationStrategy.apply(_prevViewPortInstruction$component$bindingContext, next.lifecycleArgs);
        } else if (next.config.activationStrategy) {
          viewPortPlan.strategy = next.config.activationStrategy;
        } else if (newParams || forceLifecycleMinimum) {
          viewPortPlan.strategy = activationStrategy.invokeLifecycle;
        } else {
          viewPortPlan.strategy = activationStrategy.noChange;
        }

        if (viewPortPlan.strategy !== activationStrategy.replace && prevViewPortInstruction.childRouter) {
          var path = next.getWildcardPath();
          var task = prevViewPortInstruction.childRouter.createNavigationInstruction(path, next).then(function (childInstruction) {
            viewPortPlan.childNavigationContext = prevViewPortInstruction.childRouter.createNavigationContext(childInstruction);

            return buildNavigationPlan(viewPortPlan.childNavigationContext, viewPortPlan.strategy === activationStrategy.invokeLifecycle).then(function (childPlan) {
              viewPortPlan.childNavigationContext.plan = childPlan;
            });
          });

          pending.push(task);
        }
      };

      for (var viewPortName in prev.viewPortInstructions) {
        _loop(viewPortName);
      }

      return Promise.all(pending).then(function () {
        return plan;
      });
    }

    for (var viewPortName in next.config.viewPorts) {
      plan[viewPortName] = {
        name: viewPortName,
        strategy: activationStrategy.replace,
        config: next.config.viewPorts[viewPortName]
      };
    }

    return Promise.resolve(plan);
  }

  var BuildNavigationPlanStep = (function () {
    function BuildNavigationPlanStep() {
      _classCallCheck(this, BuildNavigationPlanStep);
    }

    BuildNavigationPlanStep.prototype.run = function run(navigationContext, next) {
      return buildNavigationPlan(navigationContext).then(function (plan) {
        navigationContext.plan = plan;
        return next();
      })['catch'](next.cancel);
    };

    return BuildNavigationPlanStep;
  })();

  exports.BuildNavigationPlanStep = BuildNavigationPlanStep;

  function hasDifferentParameterValues(prev, next) {
    var prevParams = prev.params;
    var nextParams = next.params;
    var nextWildCardName = next.config.hasChildRouter ? next.getWildCardName() : null;

    for (var key in nextParams) {
      if (key === nextWildCardName) {
        continue;
      }

      if (prevParams[key] !== nextParams[key]) {
        return true;
      }
    }

    for (var key in prevParams) {
      if (key === nextWildCardName) {
        continue;
      }

      if (prevParams[key] !== nextParams[key]) {
        return true;
      }
    }

    return false;
  }

  function getInstructionBaseUrl(instruction) {
    var instructionBaseUrlParts = [];
    instruction = instruction.parentInstruction;

    while (instruction) {
      instructionBaseUrlParts.unshift(instruction.getBaseUrl());
      instruction = instruction.parentInstruction;
    }

    instructionBaseUrlParts.unshift('/');
    return instructionBaseUrlParts.join('');
  }

  var affirmations = ['yes', 'ok', 'true'];

  exports.affirmations = affirmations;

  var CanDeactivatePreviousStep = (function () {
    function CanDeactivatePreviousStep() {
      _classCallCheck(this, CanDeactivatePreviousStep);
    }

    CanDeactivatePreviousStep.prototype.run = function run(navigationContext, next) {
      return processDeactivatable(navigationContext.plan, 'canDeactivate', next);
    };

    return CanDeactivatePreviousStep;
  })();

  exports.CanDeactivatePreviousStep = CanDeactivatePreviousStep;

  var CanActivateNextStep = (function () {
    function CanActivateNextStep() {
      _classCallCheck(this, CanActivateNextStep);
    }

    CanActivateNextStep.prototype.run = function run(navigationContext, next) {
      return processActivatable(navigationContext, 'canActivate', next);
    };

    return CanActivateNextStep;
  })();

  exports.CanActivateNextStep = CanActivateNextStep;

  var DeactivatePreviousStep = (function () {
    function DeactivatePreviousStep() {
      _classCallCheck(this, DeactivatePreviousStep);
    }

    DeactivatePreviousStep.prototype.run = function run(navigationContext, next) {
      return processDeactivatable(navigationContext.plan, 'deactivate', next, true);
    };

    return DeactivatePreviousStep;
  })();

  exports.DeactivatePreviousStep = DeactivatePreviousStep;

  var ActivateNextStep = (function () {
    function ActivateNextStep() {
      _classCallCheck(this, ActivateNextStep);
    }

    ActivateNextStep.prototype.run = function run(navigationContext, next) {
      return processActivatable(navigationContext, 'activate', next, true);
    };

    return ActivateNextStep;
  })();

  exports.ActivateNextStep = ActivateNextStep;

  function processDeactivatable(plan, callbackName, next, ignoreResult) {
    var infos = findDeactivatable(plan, callbackName);
    var i = infos.length;

    function inspect(val) {
      if (ignoreResult || shouldContinue(val)) {
        return iterate();
      }

      return next.cancel(val);
    }

    function iterate() {
      if (i--) {
        try {
          var controller = infos[i];
          var result = controller[callbackName]();
          return processPotential(result, inspect, next.cancel);
        } catch (error) {
          return next.cancel(error);
        }
      }

      return next();
    }

    return iterate();
  }

  function findDeactivatable(plan, callbackName) {
    var list = arguments.length <= 2 || arguments[2] === undefined ? [] : arguments[2];

    for (var viewPortName in plan) {
      var viewPortPlan = plan[viewPortName];
      var prevComponent = viewPortPlan.prevComponent;

      if ((viewPortPlan.strategy === activationStrategy.invokeLifecycle || viewPortPlan.strategy === activationStrategy.replace) && prevComponent) {
        var controller = prevComponent.bindingContext;

        if (callbackName in controller) {
          list.push(controller);
        }
      }

      if (viewPortPlan.childNavigationContext) {
        findDeactivatable(viewPortPlan.childNavigationContext.plan, callbackName, list);
      } else if (prevComponent) {
        addPreviousDeactivatable(prevComponent, callbackName, list);
      }
    }

    return list;
  }

  function addPreviousDeactivatable(component, callbackName, list) {
    var childRouter = component.childRouter;

    if (childRouter && childRouter.currentInstruction) {
      var viewPortInstructions = childRouter.currentInstruction.viewPortInstructions;

      for (var viewPortName in viewPortInstructions) {
        var viewPortInstruction = viewPortInstructions[viewPortName];
        var prevComponent = viewPortInstruction.component;
        var prevController = prevComponent.bindingContext;

        if (callbackName in prevController) {
          list.push(prevController);
        }

        addPreviousDeactivatable(prevComponent, callbackName, list);
      }
    }
  }

  function processActivatable(navigationContext, callbackName, next, ignoreResult) {
    var infos = findActivatable(navigationContext, callbackName);
    var length = infos.length;
    var i = -1;

    function inspect(val, router) {
      if (ignoreResult || shouldContinue(val, router)) {
        return iterate();
      }

      return next.cancel(val);
    }

    function iterate() {
      i++;

      if (i < length) {
        try {
          var _ret2 = (function () {
            var _current$controller;

            var current = infos[i];
            var result = (_current$controller = current.controller)[callbackName].apply(_current$controller, current.lifecycleArgs);
            return {
              v: processPotential(result, function (val) {
                return inspect(val, current.router);
              }, next.cancel)
            };
          })();

          if (typeof _ret2 === 'object') return _ret2.v;
        } catch (error) {
          return next.cancel(error);
        }
      }

      return next();
    }

    return iterate();
  }

  function findActivatable(navigationContext, callbackName, list, router) {
    if (list === undefined) list = [];

    var plan = navigationContext.plan;
    var next = navigationContext.nextInstruction;

    Object.keys(plan).filter(function (viewPortName) {
      var viewPortPlan = plan[viewPortName];
      var viewPortInstruction = next.viewPortInstructions[viewPortName];
      var controller = viewPortInstruction.component.bindingContext;

      if ((viewPortPlan.strategy === activationStrategy.invokeLifecycle || viewPortPlan.strategy === activationStrategy.replace) && callbackName in controller) {
        list.push({
          controller: controller,
          lifecycleArgs: viewPortInstruction.lifecycleArgs,
          router: router
        });
      }

      if (viewPortPlan.childNavigationContext) {
        findActivatable(viewPortPlan.childNavigationContext, callbackName, list, viewPortInstruction.component.childRouter || router);
      }
    });

    return list;
  }

  function shouldContinue(output, router) {
    if (output instanceof Error) {
      return false;
    }

    if (isNavigationCommand(output)) {
      if (typeof output.setRouter === 'function') {
        output.setRouter(router);
      }

      return !!output.shouldContinueProcessing;
    }

    if (typeof output === 'string') {
      return affirmations.indexOf(output.toLowerCase()) !== -1;
    }

    if (output === undefined) {
      return true;
    }

    return output;
  }

  var NavigationContext = (function () {
    function NavigationContext(router, nextInstruction) {
      _classCallCheck(this, NavigationContext);

      this.router = router;
      this.nextInstruction = nextInstruction;
      this.currentInstruction = router.currentInstruction;
      this.prevInstruction = router.currentInstruction;
    }

    NavigationContext.prototype.getAllContexts = function getAllContexts() {
      var acc = arguments.length <= 0 || arguments[0] === undefined ? [] : arguments[0];

      acc.push(this);
      if (this.plan) {
        for (var key in this.plan) {
          this.plan[key].childNavigationContext && this.plan[key].childNavigationContext.getAllContexts(acc);
        }
      }
      return acc;
    };

    NavigationContext.prototype.commitChanges = function commitChanges(waitToSwap) {
      var next = this.nextInstruction;
      var prev = this.prevInstruction;
      var viewPortInstructions = next.viewPortInstructions;
      var router = this.router;
      var loads = [];
      var delaySwaps = [];

      router.currentInstruction = next;

      if (prev) {
        prev.config.navModel.isActive = false;
      }

      next.config.navModel.isActive = true;

      router.refreshBaseUrl();
      router.refreshNavigation();

      var _loop2 = function (viewPortName) {
        var viewPortInstruction = viewPortInstructions[viewPortName];
        var viewPort = router.viewPorts[viewPortName];

        if (!viewPort) {
          throw new Error('There was no router-view found in the view for ' + viewPortInstruction.moduleId + '.');
        }

        if (viewPortInstruction.strategy === activationStrategy.replace) {
          if (waitToSwap) {
            delaySwaps.push({ viewPort: viewPort, viewPortInstruction: viewPortInstruction });
          }

          loads.push(viewPort.process(viewPortInstruction, waitToSwap).then(function (x) {
            if ('childNavigationContext' in viewPortInstruction) {
              return viewPortInstruction.childNavigationContext.commitChanges();
            }
          }));
        } else {
          if ('childNavigationContext' in viewPortInstruction) {
            loads.push(viewPortInstruction.childNavigationContext.commitChanges(waitToSwap));
          }
        }
      };

      for (var viewPortName in viewPortInstructions) {
        _loop2(viewPortName);
      }

      return Promise.all(loads).then(function () {
        delaySwaps.forEach(function (x) {
          return x.viewPort.swap(x.viewPortInstruction);
        });
      });
    };

    NavigationContext.prototype.updateTitle = function updateTitle() {
      var title = this.buildTitle();
      if (title) {
        document.title = title;
      }
    };

    NavigationContext.prototype.buildTitle = function buildTitle() {
      var separator = arguments.length <= 0 || arguments[0] === undefined ? ' | ' : arguments[0];

      var next = this.nextInstruction;
      var title = next.config.navModel.title || '';
      var viewPortInstructions = next.viewPortInstructions;
      var childTitles = [];

      for (var viewPortName in viewPortInstructions) {
        var viewPortInstruction = viewPortInstructions[viewPortName];

        if ('childNavigationContext' in viewPortInstruction) {
          var childTitle = viewPortInstruction.childNavigationContext.buildTitle(separator);
          if (childTitle) {
            childTitles.push(childTitle);
          }
        }
      }

      if (childTitles.length) {
        title = childTitles.join(separator) + (title ? separator : '') + title;
      }

      if (this.router.title) {
        title += (title ? separator : '') + this.router.title;
      }

      return title;
    };

    _createClass(NavigationContext, [{
      key: 'nextInstructions',
      get: function get() {
        return this.getAllContexts().map(function (c) {
          return c.nextInstruction;
        }).filter(function (c) {
          return c;
        });
      }
    }, {
      key: 'currentInstructions',
      get: function get() {
        return this.getAllContexts().map(function (c) {
          return c.currentInstruction;
        }).filter(function (c) {
          return c;
        });
      }
    }, {
      key: 'prevInstructions',
      get: function get() {
        return this.getAllContexts().map(function (c) {
          return c.prevInstruction;
        }).filter(function (c) {
          return c;
        });
      }
    }]);

    return NavigationContext;
  })();

  exports.NavigationContext = NavigationContext;

  var CommitChangesStep = (function () {
    function CommitChangesStep() {
      _classCallCheck(this, CommitChangesStep);
    }

    CommitChangesStep.prototype.run = function run(navigationContext, next) {
      return navigationContext.commitChanges(true).then(function () {
        navigationContext.updateTitle();
        return next();
      });
    };

    return CommitChangesStep;
  })();

  exports.CommitChangesStep = CommitChangesStep;

  var RouteLoader = (function () {
    function RouteLoader() {
      _classCallCheck(this, RouteLoader);
    }

    RouteLoader.prototype.loadRoute = function loadRoute(router, config, navigationContext) {
      throw Error('Route loaders must implement "loadRoute(router, config, navigationContext)".');
    };

    return RouteLoader;
  })();

  exports.RouteLoader = RouteLoader;

  var LoadRouteStep = (function () {
    LoadRouteStep.inject = function inject() {
      return [RouteLoader];
    };

    function LoadRouteStep(routeLoader) {
      _classCallCheck(this, LoadRouteStep);

      this.routeLoader = routeLoader;
    }

    LoadRouteStep.prototype.run = function run(navigationContext, next) {
      return loadNewRoute(this.routeLoader, navigationContext).then(next)['catch'](next.cancel);
    };

    return LoadRouteStep;
  })();

  exports.LoadRouteStep = LoadRouteStep;

  function loadNewRoute(routeLoader, navigationContext) {
    var toLoad = determineWhatToLoad(navigationContext);
    var loadPromises = toLoad.map(function (current) {
      return loadRoute(routeLoader, current.navigationContext, current.viewPortPlan);
    });

    return Promise.all(loadPromises);
  }

  function determineWhatToLoad(navigationContext) {
    var toLoad = arguments.length <= 1 || arguments[1] === undefined ? [] : arguments[1];

    var plan = navigationContext.plan;
    var next = navigationContext.nextInstruction;

    for (var viewPortName in plan) {
      var viewPortPlan = plan[viewPortName];

      if (viewPortPlan.strategy === activationStrategy.replace) {
        toLoad.push({
          viewPortPlan: viewPortPlan,
          navigationContext: navigationContext
        });

        if (viewPortPlan.childNavigationContext) {
          determineWhatToLoad(viewPortPlan.childNavigationContext, toLoad);
        }
      } else {
        var viewPortInstruction = next.addViewPortInstruction(viewPortName, viewPortPlan.strategy, viewPortPlan.prevModuleId, viewPortPlan.prevComponent);

        if (viewPortPlan.childNavigationContext) {
          viewPortInstruction.childNavigationContext = viewPortPlan.childNavigationContext;
          determineWhatToLoad(viewPortPlan.childNavigationContext, toLoad);
        }
      }
    }

    return toLoad;
  }

  function loadRoute(routeLoader, navigationContext, viewPortPlan) {
    var moduleId = viewPortPlan.config.moduleId;
    var next = navigationContext.nextInstruction;

    return loadComponent(routeLoader, navigationContext, viewPortPlan.config).then(function (component) {
      var viewPortInstruction = next.addViewPortInstruction(viewPortPlan.name, viewPortPlan.strategy, moduleId, component);

      var childRouter = component.childRouter;
      if (childRouter) {
        var path = next.getWildcardPath();

        return childRouter.createNavigationInstruction(path, next).then(function (childInstruction) {
          var childNavigationContext = childRouter.createNavigationContext(childInstruction);
          viewPortPlan.childNavigationContext = childNavigationContext;

          return buildNavigationPlan(childNavigationContext).then(function (childPlan) {
            childNavigationContext.plan = childPlan;
            viewPortInstruction.childNavigationContext = childNavigationContext;

            return loadNewRoute(routeLoader, childNavigationContext);
          });
        });
      }
    });
  }

  function loadComponent(routeLoader, navigationContext, config) {
    var router = navigationContext.router;
    var lifecycleArgs = navigationContext.nextInstruction.lifecycleArgs;

    return routeLoader.loadRoute(router, config, navigationContext).then(function (component) {
      component.router = router;
      component.config = config;

      if ('configureRouter' in component.bindingContext) {
        var _ret4 = (function () {
          var _component$bindingContext;

          component.childRouter = component.childContainer.getChildRouter();

          var routerConfig = new RouterConfiguration();
          var result = Promise.resolve((_component$bindingContext = component.bindingContext).configureRouter.apply(_component$bindingContext, [routerConfig, component.childRouter].concat(lifecycleArgs)));

          return {
            v: result.then(function () {
              component.childRouter.configure(routerConfig);
              return component;
            })
          };
        })();

        if (typeof _ret4 === 'object') return _ret4.v;
      }

      return component;
    });
  }

  var Router = (function () {
    function Router(container, history) {
      _classCallCheck(this, Router);

      this.viewPorts = {};
      this.fallbackOrder = 100;
      this.recognizer = new _aureliaRouteRecognizer.RouteRecognizer();
      this.childRecognizer = new _aureliaRouteRecognizer.RouteRecognizer();
      this.routes = [];
      this.baseUrl = '';
      this.isConfigured = false;
      this.isNavigating = false;
      this.navigation = [];

      this.container = container;
      this.history = history;
      this.reset();
    }

    Router.prototype.registerViewPort = function registerViewPort(viewPort, name) {
      name = name || 'default';
      this.viewPorts[name] = viewPort;
    };

    Router.prototype.ensureConfigured = function ensureConfigured() {
      return this._configuredPromise;
    };

    Router.prototype.configure = function configure(callbackOrConfig) {
      this.isConfigured = true;

      if (typeof callbackOrConfig === 'function') {
        var _config = new RouterConfiguration();
        callbackOrConfig(_config);
        _config.exportToRouter(this);
      } else {
        callbackOrConfig.exportToRouter(this);
      }

      this.isConfigured = true;
      this._resolveConfiguredPromise();

      return this;
    };

    Router.prototype.navigate = function navigate(fragment, options) {
      if (!this.isConfigured && this.parent) {
        return this.parent.navigate(fragment, options);
      }

      return this.history.navigate(resolveUrl(fragment, this.baseUrl, this.history._hasPushState), options);
    };

    Router.prototype.navigateToRoute = function navigateToRoute(route, params, options) {
      var path = this.generate(route, params);
      return this.navigate(path, options);
    };

    Router.prototype.navigateBack = function navigateBack() {
      this.history.navigateBack();
    };

    Router.prototype.createChild = function createChild(container) {
      var childRouter = new Router(container || this.container.createChild(), this.history);
      childRouter.parent = this;
      return childRouter;
    };

    Router.prototype.generate = function generate(name, params) {
      var hasRoute = this.recognizer.hasRoute(name);
      if ((!this.isConfigured || !hasRoute) && this.parent) {
        return this.parent.generate(name, params);
      }

      if (!hasRoute) {
        throw new Error('A route with name \'' + name + '\' could not be found. Check that `name: \'' + name + '\'` was specified in the route\'s config.');
      }

      var path = this.recognizer.generate(name, params);
      return createRootedPath(path, this.baseUrl, this.history._hasPushState);
    };

    Router.prototype.createNavModel = function createNavModel(config) {
      var navModel = new NavModel(this, 'href' in config ? config.href : config.route);
      navModel.title = config.title;
      navModel.order = config.nav;
      navModel.href = config.href;
      navModel.settings = config.settings;
      navModel.config = config;

      return navModel;
    };

    Router.prototype.addRoute = function addRoute(config, navModel) {
      validateRouteConfig(config);

      if (!('viewPorts' in config) && !config.navigationStrategy) {
        config.viewPorts = {
          'default': {
            moduleId: config.moduleId,
            view: config.view
          }
        };
      }

      if (!navModel) {
        navModel = this.createNavModel(config);
      }

      this.routes.push(config);

      var path = config.route;
      if (path.charAt(0) === '/') {
        path = path.substr(1);
      }

      var state = this.recognizer.add({ path: path, handler: config });

      if (path) {
        var settings = config.settings;
        delete config.settings;
        var withChild = JSON.parse(JSON.stringify(config));
        config.settings = settings;
        withChild.route = path + '/*childRoute';
        withChild.hasChildRouter = true;
        this.childRecognizer.add({
          path: withChild.route,
          handler: withChild
        });

        withChild.navModel = navModel;
        withChild.settings = config.settings;
      }

      config.navModel = navModel;

      if ((navModel.order || navModel.order === 0) && this.navigation.indexOf(navModel) === -1) {
        if (!navModel.href && navModel.href !== '' && (state.types.dynamics || state.types.stars)) {
          throw new Error('Invalid route config: dynamic routes must specify an href to be included in the navigation model.');
        }

        if (typeof navModel.order !== 'number') {
          navModel.order = ++this.fallbackOrder;
        }

        this.navigation.push(navModel);
        this.navigation = this.navigation.sort(function (a, b) {
          return a.order - b.order;
        });
      }
    };

    Router.prototype.hasRoute = function hasRoute(name) {
      return !!(this.recognizer.hasRoute(name) || this.parent && this.parent.hasRoute(name));
    };

    Router.prototype.hasOwnRoute = function hasOwnRoute(name) {
      return this.recognizer.hasRoute(name);
    };

    Router.prototype.handleUnknownRoutes = function handleUnknownRoutes(config) {
      var callback = function callback(instruction) {
        return new Promise(function (resolve, reject) {
          function done(inst) {
            inst = inst || instruction;
            inst.config.route = inst.params.path;
            resolve(inst);
          }

          if (!config) {
            instruction.config.moduleId = instruction.fragment;
            done(instruction);
          } else if (typeof config === 'string') {
            instruction.config.moduleId = config;
            done(instruction);
          } else if (typeof config === 'function') {
            processPotential(config(instruction), done, reject);
          } else {
            instruction.config = config;
            done(instruction);
          }
        });
      };

      this.catchAllHandler = callback;
    };

    Router.prototype.updateTitle = function updateTitle() {
      if (this.parent) {
        return this.parent.updateTitle();
      }

      this.currentInstruction.navigationContext.updateTitle();
    };

    Router.prototype.reset = function reset() {
      var _this = this;

      this.fallbackOrder = 100;
      this.recognizer = new _aureliaRouteRecognizer.RouteRecognizer();
      this.childRecognizer = new _aureliaRouteRecognizer.RouteRecognizer();
      this.routes = [];
      this.isNavigating = false;
      this.navigation = [];

      if (this.isConfigured || !this._configuredPromise) {
        this._configuredPromise = new Promise(function (resolve) {
          _this._resolveConfiguredPromise = resolve;
        });
      }

      this.isConfigured = false;
    };

    Router.prototype.refreshBaseUrl = function refreshBaseUrl() {
      if (this.parent) {
        var baseUrl = this.parent.currentInstruction.getBaseUrl();
        this.baseUrl = this.parent.baseUrl + baseUrl;
      }
    };

    Router.prototype.refreshNavigation = function refreshNavigation() {
      var nav = this.navigation;

      for (var i = 0, _length = nav.length; i < _length; i++) {
        var current = nav[i];
        if (!current.href) {
          current.href = createRootedPath(current.relativeHref, this.baseUrl, this.history._hasPushState);
        }
      }
    };

    Router.prototype.createNavigationInstruction = function createNavigationInstruction() {
      var url = arguments.length <= 0 || arguments[0] === undefined ? '' : arguments[0];
      var parentInstruction = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

      var fragment = url;
      var queryString = '';

      var queryIndex = url.indexOf('?');
      if (queryIndex !== -1) {
        fragment = url.substr(0, queryIndex);
        queryString = url.substr(queryIndex + 1);
      }

      var results = this.recognizer.recognize(url);
      if (!results || !results.length) {
        results = this.childRecognizer.recognize(url);
      }

      if ((!results || !results.length) && this.catchAllHandler) {
        results = [{
          config: {
            navModel: {}
          },
          handler: this.catchAllHandler,
          params: {
            path: fragment
          }
        }];
      }

      if (results && results.length) {
        var first = results[0];
        var _instruction = new NavigationInstruction(fragment, queryString, first.params, first.queryParams || results.queryParams, first.config || first.handler, parentInstruction);

        if (typeof first.handler === 'function') {
          return evaluateNavigationStrategy(_instruction, first.handler, first);
        } else if (first.handler && 'navigationStrategy' in first.handler) {
          return evaluateNavigationStrategy(_instruction, first.handler.navigationStrategy, first.handler);
        }

        return Promise.resolve(_instruction);
      }

      return Promise.reject(new Error('Route not found: ' + url));
    };

    Router.prototype.createNavigationContext = function createNavigationContext(instruction) {
      instruction.navigationContext = new NavigationContext(this, instruction);
      return instruction.navigationContext;
    };

    _createClass(Router, [{
      key: 'isRoot',
      get: function get() {
        return false;
      }
    }]);

    return Router;
  })();

  exports.Router = Router;

  function validateRouteConfig(config) {
    if (typeof config !== 'object') {
      throw new Error('Invalid Route Config');
    }

    if (typeof config.route !== 'string') {
      throw new Error('Invalid Route Config: You must specify a route pattern.');
    }

    if (!('redirect' in config || config.moduleId || config.navigationStrategy || config.viewPorts)) {
      throw new Error('Invalid Route Config: You must specify a moduleId, redirect, navigationStrategy, or viewPorts.');
    }
  }

  function evaluateNavigationStrategy(instruction, evaluator, context) {
    return Promise.resolve(evaluator.call(context, instruction)).then(function () {
      if (!('viewPorts' in instruction.config)) {
        instruction.config.viewPorts = {
          'default': {
            moduleId: instruction.config.moduleId
          }
        };
      }

      return instruction;
    });
  }

  var PipelineProvider = (function () {
    PipelineProvider.inject = function inject() {
      return [_aureliaDependencyInjection.Container];
    };

    function PipelineProvider(container) {
      _classCallCheck(this, PipelineProvider);

      this.container = container;
      this.steps = [BuildNavigationPlanStep, CanDeactivatePreviousStep, LoadRouteStep, createRouteFilterStep('authorize'), createRouteFilterStep('modelbind'), CanActivateNextStep, DeactivatePreviousStep, ActivateNextStep, createRouteFilterStep('precommit'), CommitChangesStep, createRouteFilterStep('postcomplete')];
    }

    PipelineProvider.prototype.createPipeline = function createPipeline(navigationContext) {
      var _this2 = this;

      var pipeline = new Pipeline();
      this.steps.forEach(function (step) {
        return pipeline.withStep(_this2.container.get(step));
      });
      return pipeline;
    };

    return PipelineProvider;
  })();

  exports.PipelineProvider = PipelineProvider;

  var logger = _aureliaLogging.getLogger('app-router');

  var AppRouter = (function (_Router) {
    _inherits(AppRouter, _Router);

    AppRouter.inject = function inject() {
      return [_aureliaDependencyInjection.Container, _aureliaHistory.History, PipelineProvider, _aureliaEventAggregator.EventAggregator];
    };

    function AppRouter(container, history, pipelineProvider, events) {
      _classCallCheck(this, AppRouter);

      _Router.call(this, container, history);
      this.pipelineProvider = pipelineProvider;
      document.addEventListener('click', handleLinkClick.bind(this), true);
      this.events = events;
      this.maxInstructionCount = 10;
    }

    AppRouter.prototype.loadUrl = function loadUrl(url) {
      var _this3 = this;

      return this.createNavigationInstruction(url).then(function (instruction) {
        return _this3.queueInstruction(instruction);
      })['catch'](function (error) {
        logger.error(error);
        restorePreviousLocation(_this3);
      });
    };

    AppRouter.prototype.queueInstruction = function queueInstruction(instruction) {
      var _this4 = this;

      return new Promise(function (resolve) {
        instruction.resolve = resolve;
        _this4.queue.unshift(instruction);
        _this4.dequeueInstruction();
      });
    };

    AppRouter.prototype.dequeueInstruction = function dequeueInstruction() {
      var _this5 = this;

      var instructionCount = arguments.length <= 0 || arguments[0] === undefined ? 0 : arguments[0];

      return Promise.resolve().then(function () {
        if (_this5.isNavigating && !instructionCount) {
          return undefined;
        }

        var instruction = _this5.queue.shift();
        _this5.queue = [];

        if (!instruction) {
          return undefined;
        }

        _this5.isNavigating = true;

        if (!instructionCount) {
          _this5.events.publish('router:navigation:processing', { instruction: instruction });
        } else if (instructionCount === _this5.maxInstructionCount - 1) {
          logger.error(instructionCount + 1 + ' navigation instructions have been attempted without success. Restoring last known good location.');
          restorePreviousLocation(_this5);
          return _this5.dequeueInstruction(instructionCount + 1);
        } else if (instructionCount > _this5.maxInstructionCount) {
          throw new Error('Maximum navigation attempts exceeded. Giving up.');
        }

        var context = _this5.createNavigationContext(instruction);
        var pipeline = _this5.pipelineProvider.createPipeline(context);

        return pipeline.run(context).then(function (result) {
          return processResult(instruction, result, instructionCount, _this5);
        })['catch'](function (error) {
          return { output: error instanceof Error ? error : new Error(error) };
        }).then(function (result) {
          return resolveInstruction(instruction, result, !!instructionCount, _this5);
        });
      });
    };

    AppRouter.prototype.registerViewPort = function registerViewPort(viewPort, name) {
      var _this6 = this;

      _Router.prototype.registerViewPort.call(this, viewPort, name);

      if (!this.isActive) {
        var viewModel = this._findViewModel(viewPort);

        if ('configureRouter' in viewModel) {
          var _ret5 = (function () {
            var config = new RouterConfiguration();
            var result = Promise.resolve(viewModel.configureRouter(config, _this6));

            return {
              v: result.then(function () {
                _this6.configure(config);
                _this6.activate();
              })
            };
          })();

          if (typeof _ret5 === 'object') return _ret5.v;
        }

        this.activate();
      } else {
        this.dequeueInstruction();
      }
    };

    AppRouter.prototype._findViewModel = function _findViewModel(viewPort) {
      if (this.container.viewModel) {
        return this.container.viewModel;
      }

      if (viewPort.container) {
        var container = viewPort.container;

        while (container) {
          if (container.viewModel) {
            this.container.viewModel = container.viewModel;
            return container.viewModel;
          }

          container = container.parent;
        }
      }
    };

    AppRouter.prototype.activate = function activate(options) {
      if (this.isActive) {
        return;
      }

      this.isActive = true;
      this.options = Object.assign({ routeHandler: this.loadUrl.bind(this) }, this.options, options);
      this.history.activate(this.options);
      this.dequeueInstruction();
    };

    AppRouter.prototype.deactivate = function deactivate() {
      this.isActive = false;
      this.history.deactivate();
    };

    AppRouter.prototype.reset = function reset() {
      _Router.prototype.reset.call(this);
      this.queue = [];
      this.options = null;
    };

    _createClass(AppRouter, [{
      key: 'isRoot',
      get: function get() {
        return true;
      }
    }]);

    return AppRouter;
  })(Router);

  exports.AppRouter = AppRouter;

  function findAnchor(el) {
    while (el) {
      if (el.tagName === 'A') {
        return el;
      }

      el = el.parentNode;
    }
  }

  function handleLinkClick(evt) {
    if (!this.isActive) {
      return;
    }

    var target = findAnchor(evt.target);
    if (!target) {
      return;
    }

    if (this.history._hasPushState) {
      if (!evt.altKey && !evt.ctrlKey && !evt.metaKey && !evt.shiftKey && targetIsThisWindow(target)) {
        var _href = target.getAttribute('href');

        if (_href !== null && !(_href.charAt(0) === '#' || /^[a-z]+:/i.test(_href))) {
          evt.preventDefault();
          this.history.navigate(_href);
        }
      }
    }
  }

  function targetIsThisWindow(target) {
    var targetWindow = target.getAttribute('target');

    return !targetWindow || targetWindow === window.name || targetWindow === '_self' || targetWindow === 'top' && window === window.top;
  }

  function processResult(instruction, result, instructionCount, router) {
    if (!(result && 'completed' in result && 'output' in result)) {
      result = result || {};
      result.output = new Error('Expected router pipeline to return a navigation result, but got [' + JSON.stringify(result) + '] instead.');
    }

    var finalResult = null;
    if (isNavigationCommand(result.output)) {
      result.output.navigate(router);
    } else {
      finalResult = result;

      if (!result.completed) {
        if (result.output instanceof Error) {
          logger.error(result.output);
        }

        restorePreviousLocation(router);
      }
    }

    return router.dequeueInstruction(instructionCount + 1).then(function (innerResult) {
      return finalResult || innerResult || result;
    });
  }

  function resolveInstruction(instruction, result, isInnerInstruction, router) {
    instruction.resolve(result);

    if (!isInnerInstruction) {
      router.isNavigating = false;
      var eventArgs = { instruction: instruction, result: result };
      var eventName = undefined;

      if (result.output instanceof Error) {
        eventName = 'error';
      } else if (!result.completed) {
        eventName = 'canceled';
      } else {
        var queryString = instruction.queryString ? '?' + instruction.queryString : '';
        router.history.previousLocation = instruction.fragment + queryString;
        eventName = 'success';
      }

      router.events.publish('router:navigation:' + eventName, eventArgs);
      router.events.publish('router:navigation:complete', eventArgs);
    }

    return result;
  }

  function restorePreviousLocation(router) {
    var previousLocation = router.history.previousLocation;
    if (previousLocation) {
      router.navigate(router.history.previousLocation, { trigger: false, replace: true });
    } else {
      logger.error('Router navigation failed, and no previous location could be restored.');
    }
  }
});