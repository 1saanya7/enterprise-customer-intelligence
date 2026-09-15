"""The user's current policy is zero paid cloud usage.

This deliberately has no environment-variable override. Enabling cloud execution
requires an explicit code/policy change after the user approves revised costs.
"""

from typing import NoReturn


class CloudUsageDisabled(RuntimeError):
    pass


def require_cloud_usage(operation: str) -> NoReturn:
    raise CloudUsageDisabled(
        f"{operation} is disabled by the project's no-paid-cloud policy. "
        "Use the offline workspace. Cloud execution requires a separately approved policy change."
    )


def block_model_call(*_args, **_kwargs) -> NoReturn:
    require_cloud_usage("Live model inference")
