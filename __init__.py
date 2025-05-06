from .compare_video import CompareVideos

NODE_CLASS_MAPPINGS = {
    "CompareVideos": CompareVideos,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "CompareVideos": "🖼️ Compare: videos",
}

WEB_DIRECTORY = "./web"
__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY']