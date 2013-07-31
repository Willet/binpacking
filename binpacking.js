(function ($, undefined) {
    /*  binpacking.js

        options: see 'settings' variable.

        re-licensing restrictions:
        * underscore.js (or its portions) is licensed under MIT.
        * jquery.easing.1.3.js is licensed under BSD.

        Willet Inc. claims copyright to all remaining portions of this code.

     */
    // http://jmlr.org/papers/volume11/gyorgy10a/gyorgy10a.pdf
    // http://i11www.iti.uni-karlsruhe.de/_media/teaching/sommer2010/approximationsonlinealgorithmen/onl-bp.pdf
    "use strict";

    var defaults = {  // defaults
            debug: false,
            target: '.bin',
            easing: 'easeOutQuint',
            columns: 0,  // dynamically generated
            objects: [],  // for things like 'append'
            animationDuration: 1450,
            resizeFrequency: 300
        },
        utils = {
            getCoords: function (input, includeMargins) {
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
            },
            closestNum: function (target) {
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
                return nums[Math.min.apply(this, diffs)];
            },
            throttle: function (func, wait, options) {
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
        };

    $.easing.easeOutQuint = $.easing.easeOutQuint || function (x, t, b, c, d) {
        // mod of jquery.easing.easeOutQuint
        // gsgd.co.uk/sandbox/jquery/easing/jquery.easing.1.3.js
        return c * ((t = t / d - 1) * t * t * t * t + 1) + b;
    };

    function objInit(params) {
        // handles $().binpack({ object })
        // (add target class to each element)
        var $host = this,
            settings = $.extend({}, defaults, params);

        function collectCoords($host) {
            // get list of (coords of each content).
            // you should only trust their width/height values.
            var $blocks = $(settings.target, $host),
                lstVectors = [];  // container

            $.each($blocks, function (idx, obj) {
                var $obj = $(obj),
                    coords = utils.getCoords();
                coords.element = $obj;  // keep it
                lstVectors.push(coords);
            });
            return lstVectors;
        }

        function attachEvents() {
            // events go here
            if (settings.bindResize) {
                var throttledResize = utils.throttle(function () {
                    $host.each(layoutContents);
                }, settings.resizeFrequency);
                $(window).resize(throttledResize);
            }

            if (settings.debug) {
                window.utils = utils;
            }
        }

        function layoutContents() {
            // guess what this does
            var $blocks = $(settings.target, $host),  // blocks
                numColumns = settings.columns,
                hostCoords = utils.getCoords($host),
                columnBottoms = {},
                maxColumnBottom = 0,
                columnIndex = 0;

            if (!numColumns) {
                numColumns = parseInt($host.innerWidth() / $blocks.eq(0).outerWidth(true), 10);
            }

            // TODO: is this necessary?
            $host.css('position', 'relative');

            $blocks.each(function (idx, block) {
                var $block = $(block),
                    blockCoords = utils.getCoords($block, true),
                    newStyles = {};

                newStyles.left = hostCoords.width / numColumns * columnIndex;
                newStyles.top = (columnBottoms[columnIndex] || 0);

                $block
                    .css({position: 'absolute'})
                    .stop()
                    .animate(newStyles, settings.animationDuration, settings.easing);

                if (columnBottoms[columnIndex] !== undefined) {
                    // you can add anything to undefined and it becomes NaN
                    columnBottoms[columnIndex] += blockCoords.height || 0;
                } else {
                    columnBottoms[columnIndex] = blockCoords.height || 0;
                }

                if (columnBottoms[columnIndex] > maxColumnBottom) {
                    // tallying the play-date height of the container
                    maxColumnBottom = columnBottoms[columnIndex];
                }

                // advance or return the column index
                // (++a returns a + 1)
                columnIndex = (++columnIndex) % numColumns;
            });

            // pretend the container is actually containing the absolute stuff
            $host.height(maxColumnBottom);
        }

        attachEvents();

        return $host.each(layoutContents);  // chaining
    }

    $.fn.binpack = function () {
        var params = arguments[0];

        if (params instanceof Array) {
            // [], but not {}
        } else if (params instanceof Object) {
            // [] and {}, but [] already got picked out by previous if statement
            return objInit.apply(this, arguments);
        } else if (typeof params === 'string' && arguments.length >= 2) {
            // i.e. $.binpack('method', somethingElse)
        } else {
            // you did something really stupid
            throw ('Unsupported calling method!');
        }
    };
}(jQuery));