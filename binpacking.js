(function ($, undefined) {
    // http://jmlr.org/papers/volume11/gyorgy10a/gyorgy10a.pdf
    // http://i11www.iti.uni-karlsruhe.de/_media/teaching/sommer2010/approximationsonlinealgorithmen/onl-bp.pdf
    "use strict";

    var utils = {
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
                i = 1;
            for (i = 1; i < arguments.length; i++) {
                diff = Math.abs(target - arguments[i]);
                diffs.push(diff);
                nums[diff] = arguments[i];
            }
            return nums[Math.min.apply(this, diffs)];
        }
    };

    $.fn.binpack = function (params) {
        // TODO: allow params to be a list of objects to append
        // (add target class to each element)
        var $host = this,
            settings,
            collectCoords,
            layoutContents;

        settings = $.extend(
            {},
            {  // defaults
                target: '.bin',
                columns: 0,  // dynamically generated
                objects: []  // for things like 'append'
            },
            params
        );

        collectCoords = function ($host) {
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
        };

        layoutContents = function () {
            var $blocks = $(settings.target, $host),  // blocks
                hostCoords = utils.getCoords($host),
                columnBottoms = {},
                maxColumnBottom = 0,
                columnIndex = 0;

            if (!settings.columns) {
                settings.columns = parseInt($host.innerWidth() / $blocks.eq(0).outerWidth(true), 10);
            }

            $host.css('position', 'relative');

            $blocks.each(function (idx, block) {
                var $block = $(block),
                    blockCoords = utils.getCoords($block, true),
                    newStyles = {};

                newStyles.left = hostCoords.width / settings.columns * columnIndex;
                newStyles.top = (columnBottoms[columnIndex] || 0);

                $block.css({position: 'absolute'}).animate(newStyles, 650);

                if (columnBottoms[columnIndex] !== undefined) {
                    columnBottoms[columnIndex] += blockCoords.height || 0;
                } else {
                    columnBottoms[columnIndex] = blockCoords.height || 0;
                }

                if (columnBottoms[columnIndex] > maxColumnBottom) {
                    maxColumnBottom = columnBottoms[columnIndex];
                }

                // advance or return the column index
                // (++a returns a + 1)
                columnIndex = (++columnIndex) % settings.columns;
            });

            $host.height(maxColumnBottom);
        };

        if (params.bindResize) {
            $(window).resize(function () {
                $host.each(layoutContents);
            });
        }

        return $host.each(layoutContents);  // chaining
    };

    window.utils = utils;
}(jQuery));