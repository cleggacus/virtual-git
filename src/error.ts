export type ErrorCode = 
        "GitCommandFailed" | 
        "CloneFailed" | 
        "UndoFailed" | 
        "CheckoutFailed"| 
        "BuildImageFailed" | 
        "CreateContainerFailed" | 
        "RunContainerFailed";

export class VirtualGitError extends Error {
    public code: ErrorCode;

    public constructor(code: ErrorCode, message: string) {
        super(message);
        this.code = code;
    }
}

