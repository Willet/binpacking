(function ($, undefined) {
    "use strict";

    var utils = {
        getCoords: function (input) {
            // @param input: either a left/right/top/bottom/... object,
            //               or a jquery element.
            // failed calculations will give you NaN.
            // TODO: short circuit applies to 0
            if (input.jquery) {  // this is $(element)
                input = {
                    left: input.offset().left,
                    top: input.offset().top,
                    width: input.outerWidth(true),
                    height: input.outerHeight(true)
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
        var $host = this,
            hostCoords = utils.getCoords($host),

            settings = $.extend(
                {},
                {  // defaults
                    target: '.bin',
                    forceWidthMultiplier: true,
                    columns: 1,
                    columnWidth: 1  // 100%
                },
                params),

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
            },

            layoutContents = function () {
                var $blocks = $(settings.target, $host),  // blocks
                    minRowHeight = 0,
                    columnCounter = 0;

                $blocks.each(function (idx, block) {
                    var $block = $(block),
                        blockCoords = utils.getCoords($block),
                        $prevBlock,
                        prevBlockCoords;
                    $block.css({position: 'absolute'});  // wee

                    if (idx === 0) {  // if this is not the first block, which
                                    // should always be on the top left anyway
                        $block.css({'left': 0, 'top': 0});
                        minRowHeight = blockCoords.height;
                        return;
                    }

                    // else (not the first block)
                    $prevBlock = $($blocks[idx - 1]);
                    prevBlockCoords = utils.getCoords($prevBlock);
                    minRowHeight = Math.min(minRowHeight, prevBlockCoords.height);

                    var newCoords = {};
                    if (prevBlockCoords.right + blockCoords.width <= hostCoords.right) {
                        newCoords.top = prevBlockCoords.top;
                        newCoords.left = prevBlockCoords.right;
                    } else {
                        newCoords.top = minRowHeight;
                        newCoords.left = 0;
                    }

                    $block.css(newCoords);

                    // raise it by one and loop back to first column if needed
                    columnCounter++;
                    if (columnCounter >= settings.columns) {
                        columnCounter = 0;
                        minRowHeight  = Math.min.apply(this, []);
                        if ($blocks[idx + 1]) {
                            $($blocks[idx + 1]).css('left', 0);
                        }
                    }
                });
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