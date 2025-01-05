from fastapi import FastAPI, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pathlib import Path
import subprocess
import tempfile
import os
import logging
import time

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define base directories
BASE_DIR = Path(__file__).resolve().parent.parent
CLIPS_DIR = BASE_DIR / "clips"

# Create FastAPI app
app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/extract-clip")
async def extract_clip(
    video: UploadFile,
    start_time: float = Form(...),
    end_time: float = Form(...),
    shot_type: str = Form(...)
):
    logger.info(f"Received request - Start time: {start_time}, End time: {end_time}, Shot type: {shot_type}")
    
    # Create shot type directory if it doesn't exist
    shot_dir = CLIPS_DIR / shot_type
    shot_dir.mkdir(exist_ok=True, parents=True)
    
    # Create temporary input file
    temp_dir = tempfile.gettempdir()
    input_path = os.path.join(temp_dir, 'input_video.mp4')
    
    # Create output file in clips directory
    output_filename = f"{shot_type}_{start_time:.3f}_{end_time:.3f}.mp4"
    output_path = str(shot_dir / output_filename)

    try:
        # Save uploaded file
        with open(input_path, 'wb') as temp_input:
            content = await video.read()
            temp_input.write(content)
            temp_input.flush()
            os.fsync(temp_input.fileno())

        logger.info(f"Saved input video to: {input_path}")
        logger.info(f"File size: {os.path.getsize(input_path)} bytes")

        # Use ffmpeg to extract the clip
        duration = end_time - start_time
        command = [
            'ffmpeg',
            '-i', input_path,
            '-ss', str(start_time),
            '-t', str(duration),
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-c:a', 'aac',
            '-metadata', f'shot_type={shot_type}',
            '-strict', 'experimental',
            '-y',
            output_path
        ]
        
        logger.info(f"Running command: {' '.join(command)}")
        
        # Run ffmpeg and capture output
        process = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Log ffmpeg output
        logger.info(f"FFMPEG stdout: {process.stdout}")
        logger.info(f"FFMPEG stderr: {process.stderr}")
        logger.info(f"FFMPEG return code: {process.returncode}")

        if process.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"FFMPEG error: {process.stderr}"
            )

        # Verify output file exists and has content
        if not os.path.exists(output_path):
            raise HTTPException(
                status_code=500,
                detail="Output file was not created"
            )

        file_size = os.path.getsize(output_path)
        logger.info(f"Output file size: {file_size} bytes")

        if file_size == 0:
            raise HTTPException(
                status_code=500,
                detail="Output file is empty"
            )

        # Return the processed video file
        response = FileResponse(
            output_path,
            media_type='video/mp4',
            filename=output_filename
        )
        
        return response

    except Exception as e:
        logger.error(f"Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # Clean up temporary input file
        if os.path.exists(input_path):
            try:
                os.unlink(input_path)
            except Exception as e:
                logger.error(f"Error deleting input file: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)