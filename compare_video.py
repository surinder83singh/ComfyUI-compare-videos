import numpy as np
from PIL import Image
from nodes import PreviewImage

class CompareVideos(PreviewImage):
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images_a": ("IMAGE",),
                "images_b": ("IMAGE",),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO"
            },
            "optional": {
                "autoplay": ("BOOLEAN",{"default":True}),
            },
            
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "combine_videos"
    CATEGORY = "preview"

    def combine_videos(self, images_a, images_b, prompt, extra_pnginfo, filename_prefix="temp.compare.", autoplay=True):
        result = { "ui": { "a_images":[], "b_images": [], "autoplay" : [autoplay]} }
        if images_a is not None and len(images_a) > 0:
            result['ui']['a_images'] = self.save_images(images_a, filename_prefix, prompt, extra_pnginfo)['ui']['images']

        if images_b is not None and len(images_b) > 0:
            result['ui']['b_images'] = self.save_images(images_b, filename_prefix, prompt, extra_pnginfo)['ui']['images']

        return result

NODE_CLASS_MAPPINGS = {
    "CompareVideos": CompareVideos,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "CompareVideos": "🖼️ Compare: videos",
}
