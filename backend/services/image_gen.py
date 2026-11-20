import base64
import logging
import time
import requests
from config import settings

logger = logging.getLogger(__name__)


def _generate_via_cloudflare(prompt: str, output_path: str, token: str, account_id: str) -> str:
    """Generates image using Cloudflare Workers AI models (FLUX.1-schnell or SDXL-lightning)."""
    models = [
        "@cf/black-forest-labs/flux-1-schnell",
        "@cf/bytedance/stable-diffusion-xl-lightning",
    ]
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    last_error = None
    for model in models:
        url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model}"
        try:
            response = requests.post(url, headers=headers, json={"prompt": prompt}, timeout=60)
            if response.status_code != 200:
                raise Exception(f"HTTP {response.status_code}: {response.text}")

            content_type = response.headers.get("Content-Type", "")
            if "application/json" in content_type:
                data = response.json()
                if "result" in data and "image" in data["result"]:
                    img_bytes = base64.b64decode(data["result"]["image"])
                else:
                    raise Exception(f"Unexpected response format from Cloudflare: {data}")
            else:
                img_bytes = response.content

            with open(output_path, "wb") as f:
                f.write(img_bytes)

            logger.info(f"Image generated via Cloudflare {model} and saved to {output_path}")
            return output_path
        except Exception as e:
            logger.warning(f"Cloudflare model {model} failed: {e}")
            last_error = e

    raise last_error or Exception("Failed to generate image via Cloudflare Workers AI")


def _generate_via_huggingface(prompt: str, output_path: str) -> str:
    """Generates image using Hugging Face InferenceClient as fallback."""
    from huggingface_hub import InferenceClient

    client = InferenceClient(token=settings.HF_TOKEN)
    max_retries = 3
    for attempt in range(max_retries):
        try:
            image = client.text_to_image(
                prompt=prompt,
                model="black-forest-labs/FLUX.1-schnell",
            )
            image.save(output_path)
            logger.info(f"Image saved successfully to {output_path}")
            return output_path
        except Exception as e:
            error_msg = str(e)
            if "loading" in error_msg.lower() or "503" in error_msg:
                wait_time = 10 * (attempt + 1)
                time.sleep(wait_time)
                continue
            if attempt == max_retries - 1:
                raise Exception(f"Failed to generate image from Hugging Face: {error_msg}")
            time.sleep(2)
    return output_path


def generate_campaign_image(prompt: str, output_path: str = "poster.png") -> str:
    """
    Generates a high-quality campaign image.
    Prioritizes Cloudflare Workers AI (fast, serverless GPUs),
    falling back to Hugging Face if configured.
    """
    cf_token = settings.CLOUDFLARE_API_TOKEN
    cf_account_id = settings.CLOUDFLARE_ACCOUNT_ID

    if cf_token and cf_account_id:
        try:
            return _generate_via_cloudflare(prompt, output_path, cf_token, cf_account_id)
        except Exception as e:
            logger.error(f"Cloudflare Workers AI failed: {e}")
            if not settings.HF_TOKEN:
                raise e

    if settings.HF_TOKEN:
        return _generate_via_huggingface(prompt, output_path)

    raise Exception(
        "No image generation provider configured. Please provide CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in .env"
    )
