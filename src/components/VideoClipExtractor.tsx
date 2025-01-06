"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Pause, X, SkipBack, SkipForward } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const uploadClipToS3 = async (clipBlob, fileName) => {
    try {
      console.log(`Uploading clip: ${fileName}, Blob size: ${clipBlob.size} bytes`);
  
      // Convert Blob to ArrayBuffer
      const fileContent = await clipBlob.arrayBuffer();
      
      // Create a new FileReader
      const reader = new FileReader();
      
      // Convert the Blob to base64 using FileReader
      const base64Content = await new Promise((resolve, reject) => {
        reader.onload = () => {
          // Get the base64 string without the data URL prefix
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(clipBlob);
      });
  
      // Upload to S3 via API
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, fileContent: base64Content }),
      });
  
      if (!response.ok) {
        throw new Error(`Failed to upload clip ${fileName}`);
      }
  
      const result = await response.json();
      console.log(`Upload successful: ${fileName}`, result);
    } catch (error) {
      console.error("Error uploading clip to S3:", error);
      throw error; // Propagate the error to `extractClips`
    }
  };

interface Clip {
  startTime: number;
  endTime?: number;
  shotType?: string;
}

const VideoClipExtractor = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [clips, setClips] = useState<Clip[]>([]);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewIntervalRef = useRef(null);

  const shotTypes = [
    "forehand_drive",
    "forehand_lob",
    "forehand_overhead",
    "forehand_volley",
    "forehand_roller",
    "backhand_drive",
    "backhand_lob",
    "backhand_overhead",
    "backhand_roller",
    "backhand_volley",
    "serve",
    "forehand_cutter",
    "backhand_cutter",
    "waterfall",
    "fym",
  ];

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!videoRef.current) return;

      switch (e.key) {
        case " ": // Space
          e.preventDefault();
          handlePlayPause();
          break;
        case "[": // Create a new clip
          e.preventDefault();
          if (videoRef.current) {
            const currentTime = videoRef.current.currentTime;
            const startTime = Math.max(0, currentTime - 1); // Ensure startTime is not negative
            const endTime = currentTime + 1;
            setClips((prevClips) => [...prevClips, { startTime, endTime }]);
          }
          break;
        case "ArrowLeft": // Frame by frame backward
          e.preventDefault();
          if (videoRef.current) {
            videoRef.current.currentTime -= 1 / 30; // Assuming 30fps
          }
          break;
        case "ArrowRight": // Frame by frame forward
          e.preventDefault();
          if (videoRef.current) {
            videoRef.current.currentTime += 1 / 30; // Assuming 30fps
          }
          break;
        case "s": // Previous clip in preview mode
          e.preventDefault();
          if (isPreviewMode) handlePrevClip();
          break;
        case "a": // Next clip in preview mode
          e.preventDefault();
          if (isPreviewMode) handleNextClip();
          break;
        case "o": // 10 seconds backward
          e.preventDefault();
          if (videoRef.current) {
            videoRef.current.currentTime -= 5;
          }
          break;
        case "p": // 10 seconds forward
          e.preventDefault();
          if (videoRef.current) {
            videoRef.current.currentTime += 5;
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isPlaying]);

  const handlePrevClip = () => {
    if (currentClipIndex > 0) {
      setCurrentClipIndex((prev) => {
        const newIndex = prev - 1;
        if (isPreviewMode && videoRef.current) {
          videoRef.current.currentTime = clips[newIndex].startTime;
        }
        return newIndex;
      });
    }
  };

  const handleNextClip = () => {
    if (currentClipIndex < clips.length - 1) {
      setCurrentClipIndex((prev) => {
        const newIndex = prev + 1;
        if (isPreviewMode && videoRef.current) {
          videoRef.current.currentTime = clips[newIndex].startTime;
        }
        return newIndex;
      });
    }
  };

  const handleClipPreview = () => {
    if (clips.length === 0) {
      alert("No clips to preview");
      return;
    }
    setIsPreviewMode(!isPreviewMode);
    if (!isPreviewMode && videoRef.current) {
      const currentClip = clips[currentClipIndex];
      videoRef.current.currentTime = currentClip.startTime;
      videoRef.current.play();
    } else if (videoRef.current) {
      videoRef.current.pause(); // Stop playback when exiting preview mode
    }
  };

  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    const milliseconds = Math.floor((timeInSeconds % 1) * 1000);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
    }
  };

  const [currentTime, setCurrentTime] = useState(0); // Local state for current time
  const [playbackSpeed, setPlaybackSpeed] = useState(100); // Default speed at 100%

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time); // Update the state when time updates

      if (isPreviewMode && clips.length > 0) {
        const currentClip = clips[currentClipIndex];
        if (currentClip?.endTime && time >= currentClip.endTime) {
          // Loop back to the start of the current clip
          videoRef.current.currentTime = currentClip.startTime;
        }
      }
    }
  };

  const handleCurrentTimeChange = (e) => {
    const timeParts = e.target.value.split(":").map(parseFloat);
    if (timeParts.length === 2) {
      const newTime = timeParts[0] * 60 + timeParts[1];
      if (videoRef.current) {
        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime); // Sync the state with video time
      }
    }
  };

  const handlePlaybackSpeedChange = (e) => {
    const newSpeed = parseInt(e.target.value, 10);
    if (!isNaN(newSpeed)) {
      setPlaybackSpeed(newSpeed); // Update state
      if (videoRef.current) {
        videoRef.current.playbackRate = newSpeed / 100; // Apply speed to video
      }
    }
  };

  const incrementPlaybackSpeed = (delta) => {
    const newSpeed = playbackSpeed + delta;
    setPlaybackSpeed(newSpeed); // Update state
    if (videoRef.current) {
      videoRef.current.playbackRate = newSpeed / 100; // Apply speed to video
    }
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleDeleteClip = () => {
    if (clips.length === 0) return; // No clips to delete
    setClips((prevClips) => {
      const newClips = prevClips.filter(
        (_, index) => index !== currentClipIndex
      );
      // Adjust the current clip index to stay within bounds
      if (currentClipIndex >= newClips.length && newClips.length > 0) {
        setCurrentClipIndex(newClips.length - 1);
      } else if (newClips.length === 0) {
        setCurrentClipIndex(0); // Reset if all clips are deleted
      }
      return newClips;
    });
  };

  const skipForward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime += 1 / 30; // Skip one frame (assuming 30fps)
    }
  };

  const skipBackward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime -= 1 / 30; // Skip one frame backward
    }
  };

  const togglePreviewMode = () => {
    if (!startTime || !endTime) {
      alert("Please set both start and end times first");
      return;
    }

    setIsPreviewMode(!isPreviewMode);
    if (!isPreviewMode) {
      videoRef.current.currentTime = parseFloat(startTime);
    }
  };

  const extractClips = async () => {
    console.log("Starting clip extraction...");
    
    if (!videoFile || clips.length === 0) {
      alert("Please provide a video and create clips");
      return;
    }
  
    const unfinishedClips = clips.filter(
      (clip) => !clip.shotType || !clip.endTime
    );
    if (unfinishedClips.length > 0) {
      alert("Please assign shot types to all clips");
      return;
    }
  
    setIsExtracting(true);
    setProgress(0);
  
    try {
      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];
        console.log(`Processing clip ${i + 1}/${clips.length}:`, clip);
    
        const formData = new FormData();
        formData.append("video", videoFile);
        formData.append("start_time", clip.startTime.toString());
        formData.append("end_time", clip.endTime.toString());
        formData.append("shot_type", clip.shotType);
    
        const response = await fetch("http://localhost:8000/api/extract-clip", {
          method: "POST",
          body: formData,
        });
    
        if (!response.ok) {
          throw new Error(`Failed to process clip ${i + 1}`);
        }
    
        const clipBlob = await response.blob();
        console.log(`Clip Blob size: ${clipBlob.size} bytes`);
    
        // Get the video file name without extension
        const videoFileName = videoFile.name.replace(/\.[^/.]+$/, '');
        const timestamp = `_${clip.startTime}-${clip.endTime}`;
        const fileName = `${clip.shotType}/${videoFileName}${timestamp}.mp4`;
    
        await uploadClipToS3(clipBlob, fileName);
    
        setProgress(((i + 1) / clips.length) * 100);
      }
  
      // All clips processed successfully
      alert("All clips have been processed and uploaded successfully!");
      setClips([]); // Reset clips array
      setCurrentClipIndex(0); // Reset current clip index
      setIsPreviewMode(false); // Exit preview mode if active
      
    } catch (error) {
      console.error("Error during clip extraction:", error);
      alert(`Error processing clips: ${error.message}`);
    } finally {
      setIsExtracting(false);
      setProgress(0);
    }
  };
  

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Video Clip Extractor</CardTitle>
        <CardDescription>
          Upload a video and press [ to create a clip (1 second before and after
          the current time).
          <br />
          Keyboard shortcuts: Space (play/pause), [ (create clip), Left/Right
          (frame by frame), O (back 10s), P (forward 10s).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Input
            type="file"
            accept="video/*"
            onChange={handleFileUpload}
            className="w-full"
          />
        </div>

        {videoUrl && (
          <div className="space-y-4">
            {/* Video Player */}
            <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full"
                onTimeUpdate={handleTimeUpdate}
              />
            </div>

            {/* Play/Pause, Current Time, Playback Speed */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePlayPause}
                  title="Play/Pause (Space)"
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <div className="text-center flex items-center space-x-2">
                <span>Current Time:</span>
                <Input
                  type="text"
                  value={formatTime(currentTime)}
                  onChange={handleCurrentTimeChange}
                  className="w-24"
                />
              </div>

              <div className="text-center flex items-center space-x-2">
                <span>Playback Speed:</span>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => incrementPlaybackSpeed(-10)}
                    title="Decrease Speed by 10%"
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    value={playbackSpeed}
                    onChange={handlePlaybackSpeedChange}
                    step={10}
                    className="w-20"
                  />
                  <span>%</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => incrementPlaybackSpeed(10)}
                    title="Increase Speed by 10%"
                  >
                    +
                  </Button>
                </div>
              </div>
            </div>

            {/* Navigation and Current Clip Info */}
            {clips.length > 0 && (
              <div className="space-y-4">
                {/* Navigation Buttons */}
                <div className="flex justify-center items-center space-x-4">
                  <Button
                    variant="outline"
                    onClick={handlePrevClip}
                    disabled={currentClipIndex === 0}
                  >
                    Previous Clip
                  </Button>
                  <span className="text-sm font-medium">
                    Clip {currentClipIndex + 1}/{clips.length}
                  </span>
                  <Button
                    variant="outline"
                    onClick={handleNextClip}
                    disabled={currentClipIndex === clips.length - 1}
                  >
                    Next Clip
                  </Button>
                </div>

                {/* Current Clip Info */}
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-medium mb-2">
                    Current Clip Info
                  </h3>
                  <div className="flex flex-col space-y-4">
                    <div className="flex space-x-4 items-center">
                      <div className="flex items-center space-x-2">
                        <span>Start Time:</span>
                        <Input
                          type="text"
                          value={
                            clips[currentClipIndex]?.startTime.toFixed(3) || ""
                          }
                          onChange={(e) => {
                            const value = parseFloat(e.target.value);
                            if (!isNaN(value) && value >= 0) {
                              setClips((prevClips) => {
                                const newClips = [...prevClips];
                                newClips[currentClipIndex] = {
                                  ...newClips[currentClipIndex],
                                  startTime: value,
                                };
                                return newClips;
                              });
                            }
                          }}
                          className="w-24"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <span>End Time:</span>
                        <Input
                          type="text"
                          value={
                            clips[currentClipIndex]?.endTime?.toFixed(3) || ""
                          }
                          onChange={(e) => {
                            const value = parseFloat(e.target.value);
                            if (
                              !isNaN(value) &&
                              value > clips[currentClipIndex]?.startTime
                            ) {
                              setClips((prevClips) => {
                                const newClips = [...prevClips];
                                newClips[currentClipIndex] = {
                                  ...newClips[currentClipIndex],
                                  endTime: value,
                                };
                                return newClips;
                              });
                            }
                          }}
                          className="w-24"
                        />
                      </div>
                    </div>

                    {/* Shot Type Selection */}
                    <div className="flex items-center space-x-2">
                      <span>Shot Type:</span>
                      <Select
                        value={clips[currentClipIndex]?.shotType || ""}
                        onValueChange={(value) => {
                          setClips((prevClips) => {
                            const newClips = [...prevClips];
                            newClips[currentClipIndex] = {
                              ...newClips[currentClipIndex],
                              shotType: value,
                            };
                            return newClips;
                          });
                        }}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select shot type" />
                        </SelectTrigger>
                        <SelectContent>
                          {shotTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type.replace("_", " ").toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Preview Clips and Extract Clips */}
                <div className="space-y-4">
                  <Button
                    variant="outline"
                    onClick={handleClipPreview}
                    className="w-full"
                  >
                    {isPreviewMode ? "Stop Preview" : "Preview Clips"}
                  </Button>

                  <Button
                    className="w-full"
                    onClick={async () => {
                      await extractClips();
                      setCurrentClipIndex(0); // Reset clip index after extraction
                    }}
                    disabled={isExtracting || clips.length === 0}
                  >
                    {isExtracting ? "Processing Clips..." : "Extract All Clips"}
                  </Button>

                  {isExtracting && (
                    <Progress value={progress} className="w-full" />
                  )}
                  <Button
                    variant="destructive"
                    onClick={handleDeleteClip}
                    disabled={clips.length === 0}
                    className="w-full"
                  >
                    Delete Current Clip
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VideoClipExtractor;
