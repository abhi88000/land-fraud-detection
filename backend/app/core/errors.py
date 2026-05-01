from fastapi import HTTPException, status

class LandGuardException(HTTPException):
    def __init__(self, detail: str, status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR):
        super().__init__(status_code=status_code, detail=detail)

class DocumentNotFoundException(LandGuardException):
    def __init__(self, document_id: str):
        super().__init__(detail=f"Document with ID '{document_id}' not found.", status_code=status.HTTP_404_NOT_FOUND)

class UnauthorizedDocumentAccess(LandGuardException):
    def __init__(self, document_id: str):
        super().__init__(detail=f"Unauthorized access to document with ID '{document_id}'.", status_code=status.HTTP_403_FORBIDDEN)

class AnalysisInProgressException(LandGuardException):
    def __init__(self, document_id: str):
        super().__init__(detail=f"Analysis for document ID '{document_id}' is still in progress.", status_code=status.HTTP_409_CONFLICT)

class AnalysisFailedException(LandGuardException):
    def __init__(self, document_id: str, reason: str = "Unknown reason"):
        super().__init__(detail=f"Analysis for document ID '{document_id}' failed: {reason}", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

class InvalidFileFormatException(LandGuardException):
    def __init__(self, allowed_formats: list):
        super().__init__(detail=f"Invalid file format. Only {', '.join(allowed_formats)} are allowed.", status_code=status.HTTP_400_BAD_REQUEST)
