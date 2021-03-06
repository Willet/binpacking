(function ($, undefined) {
    /*  binpacking.js (aka massive-octo-batman, as recommended by GitHub)

        Configuration options: see 'settings' variable.                        // further reading:
                                                                               // http://jmlr.org/papers/volume11/gyorgy10a/gyorgy10a.pdf
                                                                               // http://i11www.iti.uni-karlsruhe.de/_media/teaching/sommer2010/approximationsonlinealgorithmen/onl-bp.pdf
        Willet Inc. claims copyright to all remaining portions of this code,
        licensing them under hybrid BSD and MIT licenses.
     */
    "use strict";

    var defaults = {
        after: undefined, // for locating the element after which thigns are appended
        bindResize: undefined,
        debug: false,
        target: '.bin',
        easing: 'easeOutQuint',
        columnWidth: 0,
        objects: [],  // for things like 'append'
        animationDuration: 600,
        resizeFrequency: 1000
    }, $window = $(window);

    function getCoords(input, includeMargins) {
        // @param input: either a left/right/top/bottom/... object,
        //               or a jquery element.
        // failed calculations will give you NaN.
        // TODO: short circuit applies to 0

        includeMargins = includeMargins || false;  // can't default to true

        if (input.jquery) {  // this is $(element)
            input = {
                left: input.offset().left,
                top: input.offset().top,
                width: input.outerWidth(includeMargins),
                height: input.outerHeight(includeMargins)
            };
        }
        return {
            left: input.left || (input.right - input.width),
            top: input.top || (input.bottom - input.height),
            width: input.width || (input.right - input.left),
            height: input.height || (input.bottom - input.top),
            bottom: (input.top + input.height) || input.bottom,
            right: (input.left + input.width) || input.right
        };
    }

    function each(obj, iterator, context) {
        // mod of _.each
        // github.com/jashkenas/underscore/blob/1.5.1/underscore.js#L76
        // underscore.js (or its portions) is licensed under MIT.
        // (c) 2009-2013 Jeremy Ashkenas, DocumentCloud and
        // Investigative Reporters & Editors
        var i, l, objKey;
        if (obj === null) {
            return;
        }
        if (obj.forEach) {
            obj.forEach(iterator, context);
        } else if (obj.length === +obj.length) {
            for (i = 0, l = obj.length; i < l; i++) {
                iterator.call(context, obj[i], i, obj);
            }
        } else {
            for (objKey in obj) {
                if (obj.hasOwnProperty(objKey)) {
                    iterator.call(context, obj[objKey], objKey, obj);
                }
            }
        }
    }

    function sum() {
        // really, JS?
        // mod of www.codingforums.com/showthread.php?t=218803
        var args = Array.prototype.slice.call(arguments, 0);
        return args.reduce(function (a, b) {
            return a + b;
        });
    }

    function closestNum(target) {
        // target, [numbers, ...]. returns the number closest to target.
        var nums = {},
            diff = Infinity,
            diffs = [],
            i;
        for (i = 1; i < arguments.length; i++) {
            diff = Math.abs(target - arguments[i]);
            diffs.push(diff);
            nums[diff] = arguments[i];
        }
        return nums[Math.min.apply(null, diffs)];
    }

    function throttle(func, wait, options) {
        // mod of _.throttle
        //github.com/jashkenas/underscore/blob/1.5.1/underscore.js#L648
        options = options || {};

        var context, args, result,
            timeout = null,
            previous = 0,
            later = function () {
                previous = options.leading === false ? 0 : new Date();
                timeout = null;
                result = func.apply(context, args);
            };
        return function () {
            var now = new Date(),
                remaining;
            if (!previous && options.leading === false) previous = now;
            remaining = wait - (now - previous);
            context = this;
            args = arguments;
            if (remaining <= 0) {
                clearTimeout(timeout);
                timeout = null;
                previous = now;
                result = func.apply(context, args);
            } else if (!timeout && options.trailing !== false) {
                timeout = setTimeout(later, remaining);
            }
            return result;
        };
    }

    function $pluck($objList, attrib, method) {
        // like _.pluck, but on a list of objects.
        // you can also do $pluck($('.bin'), true, 'outerHeight')
        return $objList.map(function (idx, obj) {
            return $(obj)[method || 'prop'](attrib);
        });
    }

    function relayoutInstance($element) {
        var instance = $element.data('binpackInstance');
        if (instance) {
            console.log('resize');
            instance.layout();
        }
    }

    function objInit(params) {
        // handles $().binpack({ object })
        // (add target class to each element)
        var binPacker, $hosts = this, settings;

        function initSettings(newSettings, prefix) {
            // if you give in newSettings, newSettings becomes the new settings.
            // returns settings, old or new.
            prefix = prefix || 'binpack';
            var settingsKey = prefix + 'Settings',
                _settings = $.extend({}, defaults, newSettings);

            if (newSettings) {  // set
                $hosts.data(settingsKey, _settings);
            } else {  // get
                _settings = $hosts.data(settingsKey);
                if (!_settings) {
                    // save settings for other calling methods
                    _settings = $.extend({}, defaults, newSettings);
                    $hosts.data(settingsKey, _settings);
                }
                newSettings = _settings;
            }
            return newSettings;
        }

        return $hosts.each(function (i, host) {  // chaining
            var $host = $(host), _resize;
            settings = initSettings(params);
            binPacker = new BinPack(settings);
            binPacker.$container = $host;
            binPacker.layout();

            // events go here
            // TODO: isolate if needed
            (function attachEvents() {
                _resize = throttle(function () {
                    if ($window.width() !== $window.data('binpack-width')) {
                        relayoutInstance($host);
                        $window.data('binpack-width', $window.width());
                    }
                }, settings.resizeFrequency);

                if (settings.bindResize === true) {
                    $window.resize(_resize);
                }
            }());

            // jQuery-bound data object keeps reference of this instance
            $host.data('binpackInstance', binPacker);
        });
    }

    function arrayInit($elements, after) {
        // handles $().binpack([ elements ], [after=undefined])
        // (appends target class to each element)
        var $host = this,
            targetElement;
        if (after) {
            targetElement = after;  // well you specified it
            $elements.insertAfter(targetElement);
        } else {  // put at the end
            $host.append($elements);
        }

        return objInit.apply($host);
    }


    // ========================================================================


    function BinPack(settings) {
        // definition of a BinPack "job"
        this.settings = settings;
        this.$container = null;
        this.columns = {};
    }

    BinPack.prototype.getColumnWidth = function () {
        // TODO: dynamic callable width (typeof === 'function')
        if (this.settings.columnWidth) {
            return this.settings.columnWidth;
        } else {
            // if column width is not specified, use the width of the first item
            var firstItem = $(this.settings.target, this.$container).eq(0);

            // not sure if modify...
            this.settings.columnWidth = firstItem.outerWidth(true);
            return this.settings.columnWidth;
        }
    };

    BinPack.prototype.getNumColumns = function () {
        // calculate the number of columns
        return Math.floor(this.$container.innerWidth() / this.getColumnWidth());
    };

    BinPack.prototype.getColumns = function () {
        return this.initColumns(this.getNumColumns());
    };

    BinPack.prototype.getShortestColumn = function () {
        var columns = this.getColumns(),
            shortestColumn = 0,
            shortestColumnHeight = Infinity;

        $.map(columns, function (val, key) {
            if (val.height < shortestColumnHeight) {
                shortestColumn = key;
                shortestColumnHeight = val.height;
            }
        });

        return columns[shortestColumn];
    };

    BinPack.prototype.getTallestColumn = function () {
        var columns = this.getColumns(),
            tallestColumn = 0,
            tallestColumnHeight = 0;

        $.map(columns, function (val, key) {
            if (val.height > tallestColumnHeight) {
                tallestColumn = key;
                tallestColumnHeight = val.height;
            }
        });

        return columns[tallestColumn];
    };

    BinPack.prototype.initColumns = function (columnCount, force) {
        // this runs only once.
        if (this.columns && this.columns[0]) {
            // properly initialised columns should have column #0.
            if (!force) {
                return this.columns;
            }
        }
        this.columns = {};
        for (var i = 0; i < columnCount; i++) {
            this.columns[i] = {
                'index': i,
                'contents': [],
                'width': this.settings.columnWidth,
                'height': 0
            };
        }
        return this.columns;
    };

    BinPack.prototype.addBinToColumn = function (columnId, $bin) {
        // @return: {columnId:
        //             { contents: [bin, bin, bin],
        //               width: 1234
        //               height: 1234
        //             },
        //           columnId: ...
        //          }
        try {
            this.columns[columnId].contents.push($bin);
        } catch (err) {
            this.columns[columnId].contents = [$bin];
        }
        var blockWidths = $(this.columns[columnId].contents).map(function (i, o) {
            return $(o).outerWidth(true);
        });
        var blockHeights = $(this.columns[columnId].contents).map(function (i, o) {
            return $(o).outerHeight(true);
        });
        this.columns[columnId].width = Math.max.apply(null, blockWidths);
        this.columns[columnId].height = sum.apply(null, blockHeights);

        return this.columns;
    };

    BinPack.prototype.moveBlock = function ($bin, x, y) {
        // move with css
        if ($.support.transition) {  //api.jquery.com/jQuery.support/
            $bin.css({
                left: x,
                top: y,
                // http://matthewlein.com/ceaser/
                'transition': 'all ' + this.settings.animationDuration +
                    'ms cubic-bezier(0.230, 1.000, 0.320, 1.000)',
                'transition-timing-function': 'cubic-bezier(0.165, 0.840, 0.440, 1.000)'
            });
        } else {  // jquery fallback
            $bin.animate({
                left: x,
                top: y
            }, this.settings.animationDuration, this.settings.easing);
        }
    };

    BinPack.prototype.layout = function () {
        // guess what this does
        var instance = this,  // this is a JS variable
            $container = instance.$container,  // this is the $(DOM element)
            settings = instance.settings,
            $blocks = $(settings.target, $container),  // blocks
            numColumns = instance.getNumColumns(),
            hostCoords = getCoords($container),
            centeringOffset = (hostCoords.width - numColumns * instance.getColumnWidth()) / 2;

        // this is necessary
        $container.css('position', 'relative');

        $blocks.each(function (idx, block) {
            var $block = $(block),
                newStyles = {},
                shortestColumn = instance.getShortestColumn();

            newStyles.left = centeringOffset +
                (shortestColumn.width ||
                 settings.columnWidth ||
                 (hostCoords.width - centeringOffset * 2) / settings.columns)
                    * shortestColumn.index;
            newStyles.top = shortestColumn.height;

            $block.css({position: 'absolute'}).stop();                         // keep moving elements in place

            instance.moveBlock($block, newStyles.left, newStyles.top);

            // recalculate width/height
            instance.addBinToColumn(shortestColumn.index, $block);
        });

        // pretend the container is actually containing the absolute stuff
        $container.height(instance.getTallestColumn().height);

        // reset geometry data so resizing works
        instance.initColumns(numColumns, true);
    };


    // ========================================================================


    // add the animation
    if (!$.easing.easeOutQuint) {
        $.easing.easeOutQuint = function (x, t, b, c, d) {
            // jquery.easing.easeOutQuint
            // gsgd.co.uk/sandbox/jquery/easing/jquery.easing.1.3.js
            // jquery.easing.1.3.js is licensed under BSD.
            // Copyright © 2008 George McGinley Smith
            return c * ((t = t / d - 1) * t * t * t * t + 1) + b;
        };
    }

    $.fn.binpack = function (params) {
        // this is a $(DOM element of the container)
        if (params instanceof Array) {                                         // [], but not {}
            return arrayInit.apply(this, arguments);
        } else if (params instanceof Object) {                                 // [] and {}, but [] already got picked out by previous if statement
            return objInit.apply(this, arguments);
        } else if (typeof params === 'string' && arguments.length >= 2) {      // i.e. $.binpack('method', somethingElse)
            switch (params) {
            case 'append':
                return arrayInit.apply(this, arguments);
            case 'layout':
                return this.data('binpackInstance').layout();
            default:
                // pass
            }
        }
        // you did something really stupid
        throw ('Unsupported calling method!');
    };

    (function (mediator) {
        // hooks
        if (mediator) {
            mediator.on('layout', relayoutInstance);
        }
    }(window.Willet && window.Willet.mediator));

}(jQuery));