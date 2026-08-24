import { toast } from 'sonner'
import { BaseError, ContractFunctionRevertedError } from 'viem'

const APP_VERSION = '0.1.0'

const MAX_ERROR_LENGTH = 160

/** Pulls the contract's own `require` string / custom error name out of viem's multi-paragraph
 *  BaseError dump, so a revert reason never gets lost in truncation. Shared by toastError and any
 *  write hook that wants the same short reason before it even reaches a toast. */
export function errorReason(err: unknown): string {
    if (err instanceof BaseError) {
        const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError)
        if (reverted instanceof ContractFunctionRevertedError) {
            // .reason is the decoded require(cond, "message") string — prefer it over
            // .data.errorName, which for a standard string revert is just the literal "Error" (the
            // ABI type name, not the message). errorName only carries something useful for a custom
            // Solidity error (e.g. `error InsufficientBalance()`), where .reason is never set.
            const reason = reverted.reason ?? reverted.data?.errorName
            if (reason) return reason
        }
        // Some RPC paths (e.g. batched eth_call) don't decode cleanly into a
        // ContractFunctionRevertedError, leaving shortMessage as a generic "... reverted." — the
        // node's own message (e.g. "execution reverted: payment token not allowed") still has the
        // real reason, walk the cause chain for it before giving up.
        for (let cause: unknown = err; cause; cause = (cause as { cause?: unknown }).cause) {
            const details = (cause as { details?: unknown }).details
            if (typeof details === 'string' && details) return details
        }
        return err.shortMessage
    }
    return err instanceof Error ? err.message : String(err)
}

function truncateErrorMessage(message: string, maxLength: number = MAX_ERROR_LENGTH): string {
    if (message.length <= maxLength) return message
    return message.slice(0, maxLength) + '...'
}

function formatError(error: Error | unknown, _context?: string): string {
    if (error instanceof Error) {
        const errorWithCode = error as Error & { code?: number }
        if (errorWithCode.code === 4001) {
            return 'Transaction rejected by user'
        }
        if (error.message.includes('network')) {
            return 'Network error. Please check your connection.'
        }
        return errorReason(error)
    }
    return _context || 'An error occurred'
}

export function toastError(input: Error | string, _context?: string) {
    let fullMessage: string

    if (input instanceof Error) {
        fullMessage = formatError(input, _context)
    } else {
        fullMessage = input
    }

    const truncated = truncateErrorMessage(fullMessage)
    const isTruncated = fullMessage.length > MAX_ERROR_LENGTH

    const baseAction = {
        label: 'Copy',
        onClick: () => {
            navigator.clipboard.writeText(fullMessage)
            toast.success('Error copied to clipboard')
        },
    }

    const toastOptions = {
        description: `v${APP_VERSION}`,
        action: isTruncated
            ? {
                  label: 'View Details',
                  onClick: () => {
                      toast(fullMessage, {
                          description: `v${APP_VERSION}`,
                          action: baseAction,
                      })
                  },
              }
            : baseAction,
    }

    toast.error(truncated, toastOptions)
}

export const toastSuccess = toast.success
export const toastWarning = toast.warning
