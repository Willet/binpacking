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
        }
    };

    $.fn.binpack = function (params) {
        var $host = this,
            hostCoords = utils.getCoords($host),

            settings = $.extend({  // defaults
                target: '.bin'
            }, params),

            collectCoords = function ($host) {
                // get list of (coords of each content).
                var $vectors = $(settings.target, $host),
                    lstVectors = [];  // container

                $.each($vectors, function (idx, obj) {
                    var $obj = $(obj),
                        coords = utils.getCoords();
                    coords.element = $obj;  // keep it
                    lstVectors.push(coords);
                });
                return lstVectors;
            },

            layoutContents = function () {
                var $vectors = $(settings.target, $host);  // container

                $vectors.each(function (idx, block) {
                    var $block = $(block),
                        blockCoords = utils.getCoords($block),
                        $prevBlock,
                        prevBlockCoords;
                    $block.css({position: 'absolute'});  // wee

                    if (idx === 0) {  // if this is not the first block, which
                                    // should always be on the top left anyway
                        $block.css({'left': 0, 'top': 0});
                        return;
                    }

                    // else (not the first block)
                    $prevBlock = $($vectors[idx - 1]);
                    prevBlockCoords = utils.getCoords($prevBlock);

                    var proposedCoords = {};
                    if (prevBlockCoords.right + blockCoords.width <= hostCoords.right) {
                        proposedCoords.top = prevBlockCoords.top;
                        proposedCoords.left = prevBlockCoords.right;
                    } else {
                        proposedCoords.top = prevBlockCoords.bottom;
                        proposedCoords.left = 0;
                    }

                    $block.css(proposedCoords);
                });
            };

        if (params.bindResize) {
            $(window).resize(function () {
                $host.each(layoutContents);
            });
        }

        return $host.each(layoutContents);  // chaining
    };
}(jQuery));