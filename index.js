$(document).ready(function() {
  const video = $('#myvideo')[0];
  const canvas = $('#canvas')[0];
  const context = canvas.getContext('2d');

  let trackButton = $('#trackbutton')[0];

  // Visible App Data
  let $times = $('#times');
  let $minutes = $('#minutes');
  let $days = $('#days');

  audiocontext = new AudioContext();
  source = audiocontext.createBufferSource();
  source.connect(audiocontext.destination);
  source.start(0);

  let options = {
    lowerBoundOffset: 55,
    handAndLowerBoundIntersectionWeight: 1.75,
    negativeHandAndLowerBoundIntersectionWeight: -0.25,
    handAndFaceIntersectionWeight: 1.5,
    negativeHandAndFaceIntersectionWeight: -0.25,
    runningAverageSampleLimit: 30,
    meanLimit: 0,
    handLowerBoundMeanLimit: 0,
    handScoreThreshold: 0.5,
    innerFaceBoxOffset: 30,
  };

  class MovingAverageCalculator {
    constructor() {
      this.count = 0;
      this._mean = 0;
    }

    update(newValue) {
      this.count++;

      const differential = (newValue - this._mean) / this.count;

      const newMean = this._mean + differential;

      if (this.count > options.runningAverageSampleLimit) {
        this.count = 1;
      }
      this._mean = newMean;
    }

    get mean() {
      this.validate();
      return this._mean;
    }

    validate() {
      if (this.count == 0) {
        throw new Error('Mean is undefined');
      }
    }
  }

  const handAndFace = new MovingAverageCalculator();
  const handAndLowerBound = new MovingAverageCalculator();

  let imgindex = 1;
  let isVideo = false;
  let model = null;

  // video.width = 500;
  // video.height = 400;

  video.width = 640;
  video.height = 360;

  const modelParams = {
    flipHorizontal: false, // flip e.g for video
    maxNumBoxes: 3, // maximum number of boxes to detect
    iouThreshold: 0.5, // ioU threshold for non-max suppression
    scoreThreshold: options.handScoreThreshold, // confidence threshold for predictions.
  };

  function startVideo() {
    handTrack.startVideo(video).then(function(status) {
      if (status) {
        isVideo = true;
        $('#trackToggle').attr('disabled', false);
        createFaceAPICanvas();
        runDetection();
      } else {
      }
    });
  }

  function toggleVideo() {
    if (!isVideo) {
      startVideo();
    } else {
      handTrack.stopVideo(video);
      isVideo = false;
    }
  }

  trackButton.addEventListener('click', function() {
    $('#trackToggle').attr('disabled', true);
    toggleVideo();
  });

  function runDetection() {
    model.detect(video).then(async (predictions) => {
      var detections = await runFaceDetection();

      let resizedFaceBox = getResizedFaceBox(detections);
      let face = normalizeFaceBox(resizedFaceBox);
      let innerFaceBox = getInnerFaceBox(face);

      let hand = normalizeHandBox(predictions);

      // Here we ignore hand boxes inside our innerfacebox.
      hand = ignoreHandsInsideInnerFacebox(hand, innerFaceBox);

      let intersection = compareBoxes(hand, face);

      let lowerThird = getHandTraceBox(face);
      let handAndLowerBoundIntersection = compareBoxes(lowerThird, hand);

      modifyHandAndFaceIntersectionConfidence(intersection);
      modifyhandAndLowerBoundIntersectionConfidence(
        handAndLowerBoundIntersection
      );

      areYouTouchingYourFace(handAndFace.mean, handAndLowerBound.mean);
      isYourHandInLowerBound(handAndLowerBound.mean);

      model.renderPredictions(predictions, canvas, context, video);
      if (isVideo) {
        requestAnimationFrame(runDetection);
      }
    });
  }

  // Load the model.
  handTrack.load(modelParams).then((lmodel) => {
    // detect objects in the image.
    model = lmodel;
    trackButton.disabled = false;
  });

  // End Hand Tracking.

  let loadModel = async (cb) => {
    await faceapi.nets.tinyFaceDetector.loadFromUri('./model');
    cb();
    return;
  };

  loadModel(() => {
    // console.log('Model Loaded.');
  });

  faceapi.env.monkeyPatch({
    Canvas: HTMLCanvasElement,
    Image: HTMLImageElement,
    ImageData: ImageData,
    Video: HTMLVideoElement,
    createCanvasElement: () => document.createElement('canvas'),
    createImageElement: () => document.createElement('img'),
  });

  runFaceDetection = async () => {
    let canvas = $('#facecanvas')[0];
    const detections = await faceapi.detectAllFaces(
      video,
      new faceapi.TinyFaceDetectorOptions()
    );

    const displaySize = { width: video.width, height: video.height };
    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    faceapi.draw.drawDetections(canvas, resizedDetections);
    return detections;
  };

  createFaceAPICanvas = () => {
    //create the canvas from video element as we have created above
    const faceCanvas = faceapi.createCanvasFromMedia(video);
    faceCanvas.classList.add('canvasbox');
    faceCanvas.id = 'facecanvas';
    //append canvas to body or the dom element where you want to append it
    $('#videos_and_canvases').append(faceCanvas);
    // displaySize will help us to match the dimension with video screen and accordingly it will draw our detections
    // on the streaming video screen
    const displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(faceCanvas, displaySize);

    return faceCanvas;
  };

  getResizedFaceBox = (detections) => {
    const displaySize = { width: video.width, height: video.height };
    detections = faceapi.resizeResults(detections, displaySize);

    return detections[0];
  };

  getHandTraceBox = (faceBox) => {
    if (faceBox) {
      let lowerBound = faceBox.y + faceBox.height;
      let topOfBox = lowerBound + options.lowerBoundOffset;

      let canvas = $('#facecanvas')[0];
      let context = canvas.getContext('2d');
      let box = new Box(video.height - topOfBox, video.width, 0, topOfBox);

      drawBox(box);

      return box;
    }
  };

  drawBox = (box) => {
    var context = $('#facecanvas')[0].getContext('2d');
    context.beginPath();
    context.rect(box.x, box.y, box.width, box.height);
    context.stroke();
  };

  getInnerFaceBox = (faceBox) => {
    if (faceBox) {
      let box = new Box(
        faceBox.height - options.innerFaceBoxOffset * 2,
        faceBox.width - options.innerFaceBoxOffset * 2,
        faceBox.x + options.innerFaceBoxOffset,
        faceBox.y + options.innerFaceBoxOffset
      );

      drawBox(box);
      return box;
    }
  };

  ignoreHandsInsideInnerFacebox = (hand, innerFaceBox) => {
    if (hand && innerFaceBox) {
      drawCoordinates(hand.centerPoint.x, hand.centerPoint.y);
      drawCoordinates(innerFaceBox.topLeftPoint.x, innerFaceBox.topLeftPoint.y);
      drawCoordinates(
        innerFaceBox.bottomRightPoint.x,
        innerFaceBox.bottomRightPoint.y
      );
      let p = hand.centerPoint;

      // check if center point is within the innerFaceBox
      if (
        innerFaceBox.topLeftPoint.x <= p.x &&
        p.x <= innerFaceBox.bottomRightPoint.x &&
        innerFaceBox.topLeftPoint.y <= p.y &&
        p.y <= innerFaceBox.bottomRightPoint.y
      ) {
        // console.log('Hand center point inside innerbox');
        return null;
      }

      return hand;
    }
  };

  normalizeFaceBox = (resizedFaceBox) => {
    if (resizedFaceBox) {
      let box = new Box(
        resizedFaceBox.box.height,
        resizedFaceBox.box.width,
        resizedFaceBox.box.x,
        resizedFaceBox.box.y
      );

      return box;
    }
  };

  normalizeHandBox = (handBoxes) => {
    if (handBoxes.length > 0) {
      var res = Math.max.apply(
        Math,
        handBoxes.map(function(o) {
          return o.score;
        })
      );

      var highestConfidenceHand = handBoxes.find(function(o) {
        return o.score == res;
      });

      let box = new Box(
        highestConfidenceHand.bbox[3],
        highestConfidenceHand.bbox[2],
        highestConfidenceHand.bbox[0],
        highestConfidenceHand.bbox[1]
      );

      return box;
    }
  };

  compareBoxes = (boxOne, boxTwo) => {
    let boxA = boxOne;
    let boxB = boxTwo;

    if (boxA && boxB) {
      return doBoxesIntersect(boxA, boxB);
    } else {
      return false;
    }
  };

  doBoxesIntersect = (a, b) => {
    // console.log(a, b);
    return (
      Math.abs(a.x - b.x) * 2 < a.width + b.width &&
      Math.abs(a.y - b.y) * 2 < a.height + b.height
    );
  };

  function Box(height, width, x, y) {
    this.height = height;
    this.width = width;
    this.x = x;
    this.y = y;
    this.topLeftPoint = { x, y };
    this.bottomRightPoint = { x: x + width, y: y + height };
    this.centerPoint = { x: x + width / 2, y: y + height / 2 };
  }

  notify = () => {
    // Increment our localstorage
    let faceTouchCount = localStorage.getItem('times');

    if (faceTouchCount) {
      localStorage.setItem('times', ++faceTouchCount);
    } else {
      localStorage.setItem('times', 0);
    }

    localStorage.setItem('minutes', 0);
    localStorage.setItem('lastMessageTime', Date.now());

    updateAppData();

    let notifications = [
      {
        title: 'Watch out!',
        body: 'You might have just touched your face!',
      },
    ];
    new Notification(notifications[0].title, notifications[0]);
  };

  let debouncedNotify = debounce(notify, 500);

  let areYouTouchingYourFace = (mean, handMean) => {
    let handAndFaceTag = $('#touch');

    if (mean > options.meanLimit) {
      tagDanger(handAndFaceTag);
      // Check if we are muted

      if (!isMuted()) {
        if (outsideInterval()) {
          console.log('is outside interval');
          //If we're checking for lower third, else we just check based on face limit.
          if (isLowerThirdEnabled()) {
            if (handMean > options.handLowerBoundMeanLimit) {
              debouncedNotify();
            }
          } else {
            debouncedNotify();
          }
        }
      }
    } else {
      tagSuccess(handAndFaceTag);
    }
  };

  outsideInterval = () => {
    let lastMessageTime = localStorage.getItem('lastMessageTime');
    let interval = localStorage.getItem('interval');
    let currentTime = Date.now();

    let isOutsideInterval =
      parseInt(lastMessageTime) + parseInt(interval) < currentTime;

    if (isOutsideInterval) {
      return true;
    }

    return false;
  };

  isLowerThirdEnabled = () => {
    let lowerThird = $('#lowerThird').attr('aria-checked');
    return lowerThird === 'true';
  };

  isMuted = () => {
    let isMuted = $('#mute').attr('aria-checked');
    return isMuted === 'true';
  };

  tagSuccess = (tag) => {
    tag.removeClass('tag--danger');
    tag.addClass('tag--success');
  };

  tagDanger = (tag) => {
    tag.removeClass('tag--success');
    tag.addClass('tag--danger');
  };

  let isYourHandInLowerBound = (mean) => {
    let handAndLowerBoundTag = $('#lowerBound');
    if (mean > options.handLowerBoundMeanLimit) {
      tagDanger(handAndLowerBoundTag);
    } else {
      tagSuccess(handAndLowerBoundTag);
    }
  };

  let drawCoordinates = (x, y) => {
    var pointSize = 3; // Change according to the size of the point.
    var ctx = $('#facecanvas')[0].getContext('2d');

    ctx.fillStyle = '#ff2626'; // Red color

    ctx.beginPath(); //Start path
    ctx.arc(x, y, pointSize, 0, Math.PI * 2, true); // Draw a point using the arc function of the canvas with a point structure.
    ctx.fill(); // Close the path and fill.
  };

  $('#debug').on('click', function() {
    let $debugArea = $('#debugArea');
    if ($debugArea.hasClass('hidden')) {
      $debugArea.removeClass('hidden');
    } else {
      $debugArea.addClass('hidden');
    }
  });

  $('#clear').on('click', function() {
    localStorage.clear();
    updateAppData();
  });

  $('.interval').on('click', function() {
    $this = $(this);
    // convert our selected interval to ms
    let interval = parseFloat($this.attr('interval')) * 60000;

    $this.siblings().removeClass('active');
    $this.addClass('active');
    localStorage.setItem('interval', interval);
  });

  let updateAppData = () => {
    // console.log('hydrating app data');

    let times = localStorage.getItem('times');
    let minutes = localStorage.getItem('minutes');

    setDays();

    let days = localStorage.getItem('days');
    let interval = localStorage.getItem('interval');

    if (minutes) {
      $minutes.text(minutes);
    }
    if (times) {
      $times.text(times);
    }
    if (days) {
      $days.text(days);
    }
    if (interval) {
      $(`[interval="${interval / 60000}"]`).addClass('active');
    }
  };

  hydrateDebugData = () => {};

  let modifyHandAndFaceIntersectionConfidence = (intersection) => {
    if (intersection) {
      handAndFace.update(options.handAndFaceIntersectionWeight);
    } else {
      handAndFace.update(options.negativeHandAndFaceIntersectionWeight);
    }
  };

  let modifyhandAndLowerBoundIntersectionConfidence = (intersection) => {
    if (intersection) {
      handAndLowerBound.update(options.handAndLowerBoundIntersectionWeight);
    } else {
      handAndLowerBound.update(
        options.negativeHandAndLowerBoundIntersectionWeight
      );
    }
  };

  beginTimeCount = () => {
    setInterval(() => {
      let minutes = localStorage.getItem('minutes');
      let newMinutes = ++minutes || 0;
      localStorage.setItem('minutes', newMinutes);
      updateAppData();
    }, 60000);
  };

  setDays = () => {
    let start = localStorage.getItem('start');

    if (!start) {
      start = Date.now();
      localStorage.setItem('start', start);
    }

    let today = Date.now();

    let days = (today - start) / (1000 * 60 * 60 * 24);
    days = days.toFixed(0);

    // console.log(days);
    if (days > 0) {
      localStorage.setItem('days', days);
    }
  };

  buildInputs = () => {
    for (const key in options) {
      if (options.hasOwnProperty(key)) {
        const element = options[key];
        // console.log(key + ' : ' + element);
        $('#inputs').append(inputCard(key, element));
      }
    }
  };

  let inputCard = (option, value) => {
    return `              
    <div class="input-card">
    <div>
      <p       for="${option}"
        class="block text-sm font-medium leading-5 text-gray-700 break-words"
        >${formatOption(option)}</p     >
      <div class="relative mt-1 rounded-md shadow-sm">
        <input
          id="${option}"
          type="number"
          class="block w-full form-input sm:text-sm sm:leading-5"
          placeholder="${value}"
          value="${value}"
        />
      </div>
    </div>
  </div>`;
  };

  $('#save').on('click', () => {
    for (const key in options) {
      if (options.hasOwnProperty(key)) {
        const newValue = parseFloat($('#' + key).val());
        options[key] = newValue;
        // console.log(`Set ${key} to ${newValue}`);
      }
    }
  });

  let formatOption = (option) => {
    let arr = option.split(/(?=[A-Z])/);
    let string = arr.join(' ');
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  $('#exit').on('click', function() {
    window.close();
  });

  updateAppData();
  buildInputs();
  beginTimeCount();

  // Some initial data set up.
  if (!localStorage.getItem('days')) {
    localStorage.setItem('days', 1);
    localStorage.setItem('start', Date.now());
  }
  if (!localStorage.getItem('times')) {
    localStorage.setItem('times', 0);
  }
  if (!localStorage.getItem('interval')) {
    localStorage.setItem('interval', 240000);
  }
  if (!localStorage.getItem('lastMessageTime')) {
    localStorage.setItem('lastMessageTime', 0);
  }
});

/**
 * lodash (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright jQuery Foundation and other contributors <https://jquery.org/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */

/** Used as the `TypeError` message for "Functions" methods. */
var FUNC_ERROR_TEXT = 'Expected a function';

/** Used as references for various `Number` constants. */
var NAN = 0 / 0;

/** `Object#toString` result references. */
var symbolTag = '[object Symbol]';

/** Used to match leading and trailing whitespace. */
var reTrim = /^\s+|\s+$/g;

/** Used to detect bad signed hexadecimal string values. */
var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

/** Used to detect binary string values. */
var reIsBinary = /^0b[01]+$/i;

/** Used to detect octal string values. */
var reIsOctal = /^0o[0-7]+$/i;

/** Built-in method references without a dependency on `root`. */
var freeParseInt = parseInt;

/** Detect free variable `global` from Node.js. */
var freeGlobal =
  typeof global == 'object' && global && global.Object === Object && global;

/** Detect free variable `self`. */
var freeSelf =
  typeof self == 'object' && self && self.Object === Object && self;

/** Used as a reference to the global object. */
var root = freeGlobal || freeSelf || Function('return this')();

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max,
  nativeMin = Math.min;

/**
 * Gets the timestamp of the number of milliseconds that have elapsed since
 * the Unix epoch (1 January 1970 00:00:00 UTC).
 *
 * @static
 * @memberOf _
 * @since 2.4.0
 * @category Date
 * @returns {number} Returns the timestamp.
 * @example
 *
 * _.defer(function(stamp) {
 *   console.log(_.now() - stamp);
 * }, _.now());
 * // => Logs the number of milliseconds it took for the deferred invocation.
 */
var now = function() {
  return root.Date.now();
};

/**
 * Creates a debounced function that delays invoking `func` until after `wait`
 * milliseconds have elapsed since the last time the debounced function was
 * invoked. The debounced function comes with a `cancel` method to cancel
 * delayed `func` invocations and a `flush` method to immediately invoke them.
 * Provide `options` to indicate whether `func` should be invoked on the
 * leading and/or trailing edge of the `wait` timeout. The `func` is invoked
 * with the last arguments provided to the debounced function. Subsequent
 * calls to the debounced function return the result of the last `func`
 * invocation.
 *
 * **Note:** If `leading` and `trailing` options are `true`, `func` is
 * invoked on the trailing edge of the timeout only if the debounced function
 * is invoked more than once during the `wait` timeout.
 *
 * If `wait` is `0` and `leading` is `false`, `func` invocation is deferred
 * until to the next tick, similar to `setTimeout` with a timeout of `0`.
 *
 * See [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)
 * for details over the differences between `_.debounce` and `_.throttle`.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Function
 * @param {Function} func The function to debounce.
 * @param {number} [wait=0] The number of milliseconds to delay.
 * @param {Object} [options={}] The options object.
 * @param {boolean} [options.leading=false]
 *  Specify invoking on the leading edge of the timeout.
 * @param {number} [options.maxWait]
 *  The maximum time `func` is allowed to be delayed before it's invoked.
 * @param {boolean} [options.trailing=true]
 *  Specify invoking on the trailing edge of the timeout.
 * @returns {Function} Returns the new debounced function.
 * @example
 *
 * // Avoid costly calculations while the window size is in flux.
 * jQuery(window).on('resize', _.debounce(calculateLayout, 150));
 *
 * // Invoke `sendMail` when clicked, debouncing subsequent calls.
 * jQuery(element).on('click', _.debounce(sendMail, 300, {
 *   'leading': true,
 *   'trailing': false
 * }));
 *
 * // Ensure `batchLog` is invoked once after 1 second of debounced calls.
 * var debounced = _.debounce(batchLog, 250, { 'maxWait': 1000 });
 * var source = new EventSource('/stream');
 * jQuery(source).on('message', debounced);
 *
 * // Cancel the trailing debounced invocation.
 * jQuery(window).on('popstate', debounced.cancel);
 */
function debounce(func, wait, options) {
  var lastArgs,
    lastThis,
    maxWait,
    result,
    timerId,
    lastCallTime,
    lastInvokeTime = 0,
    leading = false,
    maxing = false,
    trailing = true;

  if (typeof func != 'function') {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  wait = toNumber(wait) || 0;
  if (isObject(options)) {
    leading = !!options.leading;
    maxing = 'maxWait' in options;
    maxWait = maxing
      ? nativeMax(toNumber(options.maxWait) || 0, wait)
      : maxWait;
    trailing = 'trailing' in options ? !!options.trailing : trailing;
  }

  function invokeFunc(time) {
    var args = lastArgs,
      thisArg = lastThis;

    lastArgs = lastThis = undefined;
    lastInvokeTime = time;
    result = func.apply(thisArg, args);
    return result;
  }

  function leadingEdge(time) {
    // Reset any `maxWait` timer.
    lastInvokeTime = time;
    // Start the timer for the trailing edge.
    timerId = setTimeout(timerExpired, wait);
    // Invoke the leading edge.
    return leading ? invokeFunc(time) : result;
  }

  function remainingWait(time) {
    var timeSinceLastCall = time - lastCallTime,
      timeSinceLastInvoke = time - lastInvokeTime,
      result = wait - timeSinceLastCall;

    return maxing ? nativeMin(result, maxWait - timeSinceLastInvoke) : result;
  }

  function shouldInvoke(time) {
    var timeSinceLastCall = time - lastCallTime,
      timeSinceLastInvoke = time - lastInvokeTime;

    // Either this is the first call, activity has stopped and we're at the
    // trailing edge, the system time has gone backwards and we're treating
    // it as the trailing edge, or we've hit the `maxWait` limit.
    return (
      lastCallTime === undefined ||
      timeSinceLastCall >= wait ||
      timeSinceLastCall < 0 ||
      (maxing && timeSinceLastInvoke >= maxWait)
    );
  }

  function timerExpired() {
    var time = now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    // Restart the timer.
    timerId = setTimeout(timerExpired, remainingWait(time));
  }

  function trailingEdge(time) {
    timerId = undefined;

    // Only invoke if we have `lastArgs` which means `func` has been
    // debounced at least once.
    if (trailing && lastArgs) {
      return invokeFunc(time);
    }
    lastArgs = lastThis = undefined;
    return result;
  }

  function cancel() {
    if (timerId !== undefined) {
      clearTimeout(timerId);
    }
    lastInvokeTime = 0;
    lastArgs = lastCallTime = lastThis = timerId = undefined;
  }

  function flush() {
    return timerId === undefined ? result : trailingEdge(now());
  }

  function debounced() {
    var time = now(),
      isInvoking = shouldInvoke(time);

    lastArgs = arguments;
    lastThis = this;
    lastCallTime = time;

    if (isInvoking) {
      if (timerId === undefined) {
        return leadingEdge(lastCallTime);
      }
      if (maxing) {
        // Handle invocations in a tight loop.
        timerId = setTimeout(timerExpired, wait);
        return invokeFunc(lastCallTime);
      }
    }
    if (timerId === undefined) {
      timerId = setTimeout(timerExpired, wait);
    }
    return result;
  }
  debounced.cancel = cancel;
  debounced.flush = flush;
  return debounced;
}

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is classified as a `Symbol` primitive or object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
 * @example
 *
 * _.isSymbol(Symbol.iterator);
 * // => true
 *
 * _.isSymbol('abc');
 * // => false
 */
function isSymbol(value) {
  return (
    typeof value == 'symbol' ||
    (isObjectLike(value) && objectToString.call(value) == symbolTag)
  );
}

/**
 * Converts `value` to a number.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to process.
 * @returns {number} Returns the number.
 * @example
 *
 * _.toNumber(3.2);
 * // => 3.2
 *
 * _.toNumber(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toNumber(Infinity);
 * // => Infinity
 *
 * _.toNumber('3.2');
 * // => 3.2
 */
function toNumber(value) {
  if (typeof value == 'number') {
    return value;
  }
  if (isSymbol(value)) {
    return NAN;
  }
  if (isObject(value)) {
    var other = typeof value.valueOf == 'function' ? value.valueOf() : value;
    value = isObject(other) ? other + '' : other;
  }
  if (typeof value != 'string') {
    return value === 0 ? value : +value;
  }
  value = value.replace(reTrim, '');
  var isBinary = reIsBinary.test(value);
  return isBinary || reIsOctal.test(value)
    ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
    : reIsBadHex.test(value)
    ? NAN
    : +value;
}
