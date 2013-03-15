(function(exports) {
    'use strict';

    var isFunction = function(fn) {
            return Object.prototype.toString.call(fn) === '[object Function]';
        }

        , forEach = Array.prototype.forEach || function(fn, scope) {
            var i = 0
                , len = this.length
                ;

            if (!isFunction(fn)) {
                return;
            }

            for (; i < len; fn.call(scope || this, this[i], i, this), ++i) {}
        }

        , indexOf = Array.prototype.indexOf || function(ele) {
            var i = 0
                , len = this.length
                ;

            for (; i < len; ++i) {
                if (this[i] === ele) {
                    return i;
                }
            }
        }

        , addEventSupport = function(Cls) {
            var gEventsRepo = {}
                , ClsPrototype = Cls.prototype
                , method
                ;

            for (method in _EventPrototype) {
                if (_EventPrototype.hasOwnProperty(method)) {
                    ClsPrototype[method] = _EventPrototype[method];
                }
            }

        }

        , _EventPrototype = {

            on: function(eventType, handler) {
                var self = this
                    , events = gEventsRepo
                    , handlers = events[eventType]
                    ;

                if (!handlers) {
                    handlers = events[eventType] = [];
                }

                if (isFunction(handler)) {
                    handlers.push(handler);
                }

                return self;
            }

            , off: function(eventType, handler) {
                var self = this
                    , events = gEventsRepo
                    , handlers = events[eventType]
                    , index
                    ;

                if (handlers) {
                    if (handler && (index = indexOf.call(handlers, handler)) > -1) {
                        handlers.splice(index, 1);
                    } else if (!handler) {
                        events[eventType] = [];
                    }
                }

                return self;
            }

            , once: function(eventType, handler) {
                var self = this;

                function callback(evt) {
                    // call handler
                    handler(evt);

                    // remove itself
                    self.off(eventType, callback);
                }

                self.on(eventType, callback);
            }

            , fire: function(eventType, data) {
                var self = this
                    , events = gEvents
                    , handlers = events[eventType] || []
                    ;

                // prevent removing the handler when call handler, so copy the handlers again
                forEach.call(handlers.slice(0), function(handler) {
                    handler.call(self, data);
                });

                return self;
            }
        }
    ;

    exports.JEvent = {
        addEventSupport: addEventSupport
    };

})(window);
