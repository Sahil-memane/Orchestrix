from .data_task import transform_data
from .image_task import compress_image
from .email_task import send_email

TASK_REGISTRY = {
    "data_transform": transform_data,
    "image_processing": compress_image,
    "email_send": send_email,
}
