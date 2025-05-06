import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

// Helper function to construct image URLs for ComfyUI
function imageDataToUrl(data) {
  return api.apiURL(
    `/view?filename=${encodeURIComponent(data.filename)}&type=${
      data.type
    }&subfolder=${data.subfolder}` + app.getPreviewFormatParam()
  );
}

function startDraggingItems(node, pointer) {
  app.canvas.emitBeforeChange()
  app.canvas.graph?.beforeChange()
  // Ensure that dragging is properly cleaned up, on success or failure.
  pointer.finally = () => {
    app.canvas.isDragging = false
    app.canvas.graph?.afterChange()
    app.canvas.emitAfterChange()
  }
  app.canvas.processSelect(node, pointer.eDown, true)
  app.canvas.isDragging = true
}
function processDraggedItems(e) {
  if (e.shiftKey || LiteGraph.alwaysSnapToGrid)
    app.graph?.snapToGrid(app.canvas.selectedItems)
  app.canvas.dirty_canvas = true
  app.canvas.dirty_bgcanvas = true
  app.canvas.onNodeMoved?.(findFirstNode(app.canvas.selectedItems))
}
function allowDragFromWidget(widget) {
  widget.onPointerDown = function(pointer, node) {
      node.onMouseDown(pointer.eDown ?? pointer.eLastDown)
      pointer.onDragStart = () => startDraggingItems(node, pointer)
      pointer.onDragEnd = processDraggedItems
      app.canvas.dirty_canvas = true
      return true
  }
}

app.registerExtension({
  name: "Matoo.CompareVideos",
  async nodeCreated(node) {
    // Ensure this applies only to the specific node type
    if (node.comfyClass !== "CompareVideos") return;

    let canvasElement = document.createElement("canvas");
    let previewWidget = node.addDOMWidget("videopreview", "preview", canvasElement, {
        serialize: false,
        hideOnZoom: false,
        getValue() {
            return canvasElement.value
        },
        setValue(v) {
          canvasElement.value = v
        },
    });
    canvasElement.value = { hidden: false, paused: false, params: {} };
    canvasElement.style.width = "100%"
    canvasElement.style.height = "100%"

    allowDragFromWidget(previewWidget)
    previewWidget.computeSize1 = function(width) {
        if (node.aspectRatio && !node.parentEl.hidden) {
            let height = (node.size[0]-20)/ node.aspectRatio + 10;
            if (!(height > 0)) {
                height = 0;
            }
            node.computedHeight = height + 10;
            return [width, height];
        }
        return [width, -4];//no loaded src, widget should not display
    }
    previewWidget.onClick = function(e){
      node.onMouseDown(e)
    }
    // canvasElement.addEventListener('contextmenu', (e)  => {
    //     //e.preventDefault()
    //     return app.canvas._mousedown_callback(e)
    // }, true);
    canvasElement.addEventListener('pointerdown', (e)  => {
        e.preventDefault()
        return app.canvas.processMouseDown(e)
    }, true);
    canvasElement.addEventListener('mousewheel', (e)  => {
        e.preventDefault()
        return app.canvas.processMouseWheel(e)
    }, true);
    canvasElement.addEventListener('pointermove', (e)  => {
        e.preventDefault()
        return app.canvas.processMouseMove(e)
    }, true);
    canvasElement.addEventListener('pointerup', (e)  => {
        e.preventDefault()
        return app.canvas.processMouseUp(e)
    }, true);


    // Constants for layout and sizing
    const marginTop = 90; // Space at the top for node UI elements
    const verticalOffset = 0; // Adjustment for canvas positioning
    const minSize = 256; // Minimum size of the node
    const maxSize = 2048; // Maximum size of the node
    const padding = 0; // Padding around the image area
    let autoplayIntervalId, drawInfo={};
    let ctx = canvasElement.getContext("2d")

    // Initialize node properties
    node.size = [512, 512 + marginTop];
    node.data = {
      images: new Array(4).fill(null).map(()=>{[]}), // Array to hold up to 4 images
      sliderX: null, // X position of the vertical slider
      sliderY: null, // Y position of the horizontal slider
    };

    // Enable resizing
    node.flags |= LiteGraph.RESIZABLE;

    // Handle resizing to maintain square aspect ratio
    node.onResize__ = function (size) {
      // const minDimension = Math.max(
      //   minSize,
      //   Math.min(size[0], size[1] - marginTop)
      // );
      // const maxDimension = Math.min(maxSize, minDimension);
      // size[0] = maxDimension;
      // size[1] = maxDimension + marginTop;

      // const fullImgWidth = size[0] - 3 * padding;
      // const fullImgHeight = size[1] - padding - marginTop;

      // // Update slider positions proportionally
      // if (node.data.hasOwnProperty("sliderX")) {
      //   const oldWidth = node.size[0] - 3 * padding;
      //   const oldHeight = node.size[1] - padding - marginTop;
      //   const relativeX = (node.data.sliderX - padding) / oldWidth;
      //   const relativeY = (node.data.sliderY - marginTop) / oldHeight;
      //   node.data.sliderX = padding + fullImgWidth * relativeX;
      //   node.data.sliderY = marginTop + fullImgHeight * relativeY;
      // } else {
      //   node.data.sliderX = padding + fullImgWidth / 2;
      //   node.data.sliderY = marginTop + fullImgHeight / 2;
      // }

      node.size = size;
      return size;
    };

    // Handle mouse down to move sliders
    node.onMouseMove = function (e) {
      if (node.data.autoplay)
        return
      const rect = node.getBounding();
      const [clickX, clickY] = [
        e.canvasX - rect[0],
        e.canvasY - rect[1] + verticalOffset,
      ];

      const xStart = padding;
      const xEnd = xStart + (node.size[0] - 3 * padding);
      const yStart = marginTop;
      const yEnd = yStart + (node.size[1] - padding - marginTop);

      if (
        clickX >= xStart &&
        clickX <= xEnd &&
        clickY >= yStart &&
        clickY <= yEnd
      ) {
        node.data.position = Math.max(xStart, Math.min(clickX, xEnd)) / (xEnd - xStart);
       
        app.graph.setDirtyCanvas(true, true);
        return true;
      }
      return false;
    };

    // Handle mouse down to move sliders
    node.onMouseDown = function (e) {
      
      const rect = node.getBounding();
      const [clickX, clickY] = [
        e.canvasX - rect[0],
        e.canvasY - rect[1] + verticalOffset,
      ];

      const xStart = padding;
      const xEnd = xStart + (node.size[0] - 3 * padding);
      const yStart = marginTop;
      const yEnd = yStart + (node.size[1] - padding - marginTop);
      if (
        clickX >= xStart &&
        clickX <= xEnd &&
        clickY >= yStart &&
        clickY <= yEnd
      ) {
        const hasImage2 = node.data.images[1]?.length > 0;
        const hasImage3 = node.data.images[2]?.length > 0;
        const hasImage4 = node.data.images[3]?.length > 0;

        // Lock sliderY to bottom if only two images are present
        if (hasImage2 && !hasImage3 && !hasImage4) {
          node.data.sliderY = yEnd;
        }

        node.data.sliderX = Math.max(xStart, Math.min(clickX, xEnd));
        node.data.sliderY =
          hasImage3 || hasImage4
            ? Math.max(yStart, Math.min(clickY, yEnd))
            : yEnd;

        app.graph.setDirtyCanvas(true, true);
        return true;
      }
      return false;
    };

    
    function stopPlaying(){
      if(autoplayIntervalId)
        clearInterval(autoplayIntervalId)
      autoplayIntervalId = null
    }

    function startPlaying(){
      stopPlaying()
      autoplayIntervalId = setInterval(()=>{
        node._draw()
      }, 1000 / 30)
    }


    // Load images when the node is executed
    node.onExecuted = async function (message) {
      node.data.images = new Array(4).fill(null).map(()=>[]);
      node.data.frameIndex = 0;
      node.data.maxFrames = 0;
      node.data.autoplay = node.widgets.find(w=>w.name=="autoplay")?.value ?? false
      let map = {1:"a", 2:"b", 3:"c", 4:"d"}
      for (let i = 1; i <= 4; i++) {
        const images = message[`${map[i]}_images`] || [];
        if (images.length) {
          if (node.data.maxFrames == 0){
            node.data.maxFrames = images.length
          }else{
            node.data.maxFrames = Math.min(images.length, node.data.maxFrames)
          }
          for (let imgData of images){
            const img = new Image();
            img.src = imageDataToUrl(imgData);
            await new Promise((resolve) => (img.onload = img.onerror = resolve));
            node.data.images[i - 1].push(img);
          }
        }
      }
      app.graph.setDirtyCanvas(true, true);
      stopPlaying()
      if(node.data.autoplay){
        startPlaying()
      }
    };

    // Render images and sliders
    node.onDrawForeground = function (canvasCtx) {
      node._draw(canvasCtx)
    }
    node._draw = function (canvasCtx) {
      if (node.__drawing)
        return
      node.__drawing = true;
      node.__draw(canvasCtx)
      node.__drawing = false;
    }
    node.__draw = function (canvasCtx) {
      if (!ctx && canvasCtx)
        ctx = canvasCtx
      if (!ctx){
        return
      }
      
      if (canvasCtx){
        let xStart = padding;
        let xEnd = xStart + (node.size[0] - 3 * padding);
        let yStart = 0;
        let yEnd = yStart + (node.size[1] - padding - marginTop);
        let fullImgWidth = node.size[0] - 3 * padding;
        let fullImgHeight = node.size[1] - padding - marginTop;
        canvasElement.width = fullImgWidth
        canvasElement.height = fullImgHeight
        drawInfo = {xStart, xEnd, yStart, yEnd, fullImgWidth, fullImgHeight}
      }

      let {xStart, xEnd, yStart, yEnd, fullImgWidth, fullImgHeight} = drawInfo;

      // Calculate fitted rectangle for image display
      function getFittedDestRect(dx, dy, dWidth, dHeight, targetRatio) {
        let newWidth = dWidth;
        let newHeight = dWidth / targetRatio;
        if (newHeight > dHeight) {
          newHeight = dHeight;
          newWidth = dHeight * targetRatio;
        }
        const offsetX = dx + (dWidth - newWidth) / 2;
        const offsetY = dy + (dHeight - newHeight) / 2;
        return [offsetX, offsetY, newWidth, newHeight];
      }

      // Draw a cropped image within specified bounds
      function drawCroppedImage(img, dx, dy, dWidth, dHeight) {
        if (!img) return;
        let targetRatio = dWidth / dHeight;
        if (
          node.data.images[0][0] &&
          node.data.images[0][0].naturalWidth &&
          node.data.images[0][0].naturalHeight
        ) {
          targetRatio =
            node.data.images[0][0].naturalWidth /
            node.data.images[0][0].naturalHeight;
        }

        const [ndx, ndy, ndWidth, ndHeight] = getFittedDestRect(
          dx,
          dy,
          dWidth,
          dHeight,
          targetRatio
        );

        const imgRatio = img.naturalWidth / img.naturalHeight;
        let sx = 0,
          sy = 0,
          sWidth = img.naturalWidth,
          sHeight = img.naturalHeight;
        if (imgRatio > targetRatio) {
          sWidth = img.naturalHeight * targetRatio;
          sx = (img.naturalWidth - sWidth) / 2;
        } else if (imgRatio < targetRatio) {
          sHeight = img.naturalWidth / targetRatio;
          sy = (img.naturalHeight - sHeight) / 2;
        }
        ctx.drawImage(
          img,
          sx,
          sy,
          sWidth,
          sHeight,
          ndx,
          ndy,
          ndWidth,
          ndHeight
        );
      }

      const connectedImages = node.data.images
        .slice(1)
        .filter((images) => images?.length > 0).length;

      if (connectedImages === 0) {
        // Single image display
        if (node.data.images[0]?.length) {
          drawCroppedImage(
            node.data.images[0][0],
            xStart,
            yStart,
            fullImgWidth,
            fullImgHeight
          );
        }
      } else if (connectedImages === 1 && node.data.images[1][0]) {
        // Two images with vertical split
        const splitX = node.data.sliderX;
        let frameIndex;
        if (node.data.autoplay){
          frameIndex = node.data.frameIndex;
        }else{
          frameIndex = Math.floor(node.data.position * node.data.maxFrames)
        }
        ctx.save();
        ctx.beginPath();
        ctx.rect(xStart, yStart, splitX - xStart, fullImgHeight);
        ctx.clip();
        drawCroppedImage(
          node.data.images[0][frameIndex],
          xStart,
          yStart,
          fullImgWidth,
          fullImgHeight
        );
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.rect(splitX, yStart, xEnd - splitX, fullImgHeight);
        ctx.clip();
        drawCroppedImage(
          node.data.images[1][frameIndex],
          xStart,
          yStart,
          fullImgWidth,
          fullImgHeight
        );
        ctx.restore();
        if (node.data.autoplay){
          node.data.frameIndex++;
          if (node.data.frameIndex >= node.data.maxFrames){
            node.data.frameIndex = 0;
          }
        }
      } else {
       
        // Three or four images with quadrants
        const drawQuadrant = (imgIndex, clipX, clipY, clipW, clipH) => {
          if (!node.data.images[imgIndex][0]) return;
          ctx.save();
          ctx.beginPath();
          ctx.rect(clipX, clipY, clipW, clipH);
          ctx.clip();
          drawCroppedImage(
            node.data.images[imgIndex][0],
            xStart,
            yStart,
            fullImgWidth,
            fullImgHeight
          );
          ctx.restore();
        };

        drawQuadrant(
          0,
          xStart,
          yStart,
          node.data.sliderX - xStart,
          node.data.sliderY - yStart
        );
        drawQuadrant(
          1,
          node.data.sliderX,
          yStart,
          xEnd - node.data.sliderX,
          node.data.sliderY - yStart
        );

        if (!node.data.images[3][0]) {
          drawQuadrant(
            2,
            xStart,
            node.data.sliderY,
            xEnd - xStart,
            yEnd - node.data.sliderY
          );
        } else {
          drawQuadrant(
            2,
            xStart,
            node.data.sliderY,
            node.data.sliderX - xStart,
            yEnd - node.data.sliderY
          );
          drawQuadrant(
            3,
            node.data.sliderX,
            node.data.sliderY,
            xEnd - node.data.sliderX,
            yEnd - node.data.sliderY
          );
        }
      }

      // Draw sliders
      ctx.strokeStyle = "#FFF";
      ctx.lineWidth = 1;
      if (connectedImages > 0) {
        ctx.beginPath();
        if (!node.data.images[3][0] && !node.data.images[2][0]) {
          ctx.moveTo(node.data.sliderX, yStart);
          ctx.lineTo(node.data.sliderX, node.data.sliderY);
        } else {
          ctx.moveTo(node.data.sliderX, yStart);
          ctx.lineTo(node.data.sliderX, yEnd);
        }
        if (connectedImages >= 2) {
          ctx.moveTo(xStart, node.data.sliderY);
          ctx.lineTo(xEnd, node.data.sliderY);
        }
        ctx.stroke();
      }
    };
  },
});

// function fitHeight(node) {
//   node.setSize([node.size[0], node.computeSize([node.size[0], node.size[1]])[1]])
//   node?.graph?.setDirtyCanvas(true);
// }
