(function ($, undefined) {
    /*  binpacking.js (aka massive-octo-batman, as recommended by GitHub)

        Configuration options: see 'settings' variable.

        re-licensing restrictions:
        * underscore.js (or its portions) is licensed under MIT.
          (c) 2009-2013 Jeremy Ashkenas, DocumentCloud and
          Investigative Reporters & Editors
        * jquery.easing.1.3.js is licensed under BSD.
          Copyright © 2008 George McGinley Smith

        Willet Inc. claims copyright to all remaining portions of this code,
        licensing them under hybrid BSD and MIT licenses:

        Permission is hereby granted, free of charge, to any person obtaining
        a copy of this software and associated documentation files (the
        "Software"), to deal in the Software without restriction, including
        without limitation the rights to use, copy, modify, merge, publish,
        distribute, sublicense, and/or sell copies of the Software, and to
        permit persons to whom the Software is furnished to do so, subject to
        the following conditions:

        - The above copyright notice and this permission notice shall be
        included in all copies or substantial portions of the Software.

        - Redistributions of source code must retain the above copyright notice,
        this list of conditions and the following disclaimer.
        - Redistributions in binary form must reproduce the above copyright
        notice, this list of conditions and the following disclaimer in the
        documentation and/or other materials provided with the distribution.

        - Neither the name of the author nor the names of contributors may be
        used to endorse or promote products derived from this software without
        specific prior written permission.

        THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
        "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
        LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
        A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
        OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
        SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
        LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
        DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
        THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
        (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
        OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
     */
    "use strict";
    // further reading:
    // http://jmlr.org/papers/volume11/gyorgy10a/gyorgy10a.pdf
    // http://i11www.iti.uni-karlsruhe.de/_media/teaching/sommer2010/approximationsonlinealgorithmen/onl-bp.pdf

    var defaults, utils;

    defaults = {  // defaults
        after: undefined, // for locating the element after which thigns are appended
        debug: false,
        target: '.bin',
        easing: 'easeOutQuint',
        columns: 0,  // dynamically generated
        objects: [],  // for things like 'append'
        animationDuration: 1450,
        resizeFrequency: 300
    };

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

    function initSettings($host, newSettings, prefix) {
        prefix = prefix || 'binpack';
        if (newSettings) {  // set
            $host.data(prefix + '-settings', newSettings);
        } else {  // get
            var _settings = $host.data(prefix + '-settings');
            if (!_settings) {
                // save settings for other calling methods
                _settings = $.extend({}, defaults, newSettings);
                $host.data(prefix + '-settings', _settings);
                newSettings = _settings;
            }
        }
        return newSettings;
    }

    function layoutContents($host, settings) {
        // guess what this does

        settings = initSettings($host);

        var $blocks = $(settings.target, $host),  // blocks
            numColumns = settings.columns,
            hostCoords = utils.getCoords($host),
            columnBottoms = {},
            maxColumnBottom = 0,
            columnIndex = 0;

        if (!numColumns) {
            // auto-calculate number of columns based on
            // the width of the first block
            numColumns = parseInt($host.innerWidth() / $blocks.eq(0).outerWidth(true), 10);
        }

        // this is necessary
        $host.css('position', 'relative');

        $blocks.each(function (idx, block) {
            var $block = $(block),
                blockCoords = utils.getCoords($block, true),
                newStyles = {};

            newStyles.left = hostCoords.width / numColumns * columnIndex;
            newStyles.top = (columnBottoms[columnIndex] || 0);

            $block
                .css({position: 'absolute'})
                .stop()  // keep moving elements in place
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

    function objInit(params) {
        // handles $().binpack({ object })
        // (add target class to each element)
        var $host = this, settings;

        settings = initSettings($host, params);

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
            // add the animation
            $.easing.easeOutQuint = $.easing.easeOutQuint ||
                function (x, t, b, c, d) {
                    // mod of jquery.easing.easeOutQuint
                    // gsgd.co.uk/sandbox/jquery/easing/jquery.easing.1.3.js
                    return c * ((t = t / d - 1) * t * t * t * t + 1) + b;
                };

            // events go here
            if (settings.bindResize) {
                var throttledResize = utils.throttle(function () {
                    $host.each(function (i, o) {
                        layoutContents($(o));
                    });
                }, settings.resizeFrequency);
                $(window).resize(throttledResize);
            }

            if (settings.debug) {
                window.utils = utils;
            }
        }

        layoutContents($host, settings);

        attachEvents();

        return $host.each(function (i, o) {  // chaining
            layoutContents($(o));
        });
    }

    function arrayInit($elements, after) {
        // handles $().binpack([ elements ], [after=undefined])
        // (appends target class to each element)
        var $host = this,
            newParams,
            targetElement;
        if (after) {
            targetElement = after;  // well you specified it
            $elements.insertAfter(targetElement);
        } else {  // put at the end
            $host.append($elements);
        }

        layoutContents($host, undefined);

        return $host.each($.noop);
    }

    $.fn.binpack = function (params) {
        if (params instanceof Array) {
            // [], but not {}
            return arrayInit.apply(this, arguments);
        } else if (params instanceof Object) {
            // [] and {}, but [] already got picked out by previous if statement
            return objInit.apply(this, arguments);
        } else if (typeof params === 'string' && arguments.length >= 2) {
            // i.e. $.binpack('method', somethingElse)
            switch (params) {
            case 'append':
                return arrayInit.apply(this, arguments);
            default:
                throw ('Unsupported calling method!');
            }
        } else {
            // you did something really stupid
            throw ('Unsupported calling method!');
            // return this.each($.noop);
        }
    };
}(jQuery));