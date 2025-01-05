'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle 
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { Progress } from "@/components/ui/progress";

const VideoClipExtractor = () => {
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [shotType, setShotType] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const videoRef = useRef(null);
  const previewIntervalRef = useRef(null);

  const shotTypes = [
    'forehand_drive',
    'forehand_lob',
    'forehand_overhead',
    'forehand_volley',
    'forehand_roller',
    'backhand_drive',
    'backhand_lob',
    'backhand_overhead',
    'backhand_roller',
    'backhand_volley',
    'serve',
    'waterfall',
    'fym'
  ];

  useEffect(() => {
    // Keyboard event listeners
    const handleKeyPress = (e) => {
      if (!videoRef.current) return;

      switch(e.key) {
        case ' ': // Space
          e.preventDefault();
          handlePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skipBackward();
          break;
        case 'ArrowRight':
          e.preventDefault();
          skipForward();
          break;
        case '[':
          e.preventDefault();
          setStartTime(videoRef.current.currentTime.toFixed(3));
          break;
        case ']':
          e.preventDefault();
          setEndTime(videoRef.current.currentTime.toFixed(3));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPlaying]);

  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    const milliseconds = Math.floor((timeInSeconds % 1) * 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const currentTime = videoRef.current.currentTime;
      document.getElementById('currentTime').textContent = formatTime(currentTime);
      
      // Handle preview mode
      if (isPreviewMode && currentTime >= parseFloat(endTime)) {
        videoRef.current.currentTime = parseFloat(startTime);
      }
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

  const skipForward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime += 1/30; // Skip one frame (assuming 30fps)
    }
  };

  const skipBackward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime -= 1/30; // Skip one frame backward
    }
  };

  const togglePreviewMode = () => {
    if (!startTime || !endTime) {
      alert('Please set both start and end times first');
      return;
    }

    setIsPreviewMode(!isPreviewMode);
    if (!isPreviewMode) {
      videoRef.current.currentTime = parseFloat(startTime);
    }
  };

  const extractClip = async () => {
    if (!videoFile || !startTime || !endTime || !shotType) {
      alert('Please provide all required information');
      return;
    }

    setIsExtracting(true);
    setProgress(0);

    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('start_time', startTime);
    formData.append('end_time', endTime);
    formData.append('shot_type', shotType);

    try {
      const response = await fetch('http://localhost:8000/api/extract-clip', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        alert('Clip saved successfully!');
      } else {
        alert('Error extracting clip');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error extracting clip');
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
          Upload a video and select time ranges to extract clips
          <br />
          Keyboard shortcuts: Space (play/pause), Arrow keys (frame step), [ ] (set start/end)
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
            <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full"
                onTimeUpdate={handleTimeUpdate}
              />
            </div>

            <div className="flex items-center justify-center space-x-4">
              <Button
                variant="outline"
                size="icon"
                onClick={skipBackward}
                title="Previous frame (Left arrow)"
              >
                <SkipBack className="h-4 w-4" />
              </Button>

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

              <Button
                variant="outline"
                size="icon"
                onClick={skipForward}
                title="Next frame (Right arrow)"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            <div className="text-center">
              Current Time: <span id="currentTime">00:00.000</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start Time (seconds)</label>
                <Input
                  type="number"
                  step="0.001"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  placeholder="0.000"
                  title="Press [ to set to current time"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Time (seconds)</label>
                <Input
                  type="number"
                  step="0.001"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  placeholder="0.000"
                  title="Press ] to set to current time"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Shot Type</label>
              <Select onValueChange={setShotType} value={shotType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select shot type" />
                </SelectTrigger>
                <SelectContent>
                  {shotTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace('_', ' ').toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <Button 
                variant="outline"
                className="w-full"
                onClick={togglePreviewMode}
              >
                {isPreviewMode ? 'Stop Preview' : 'Preview Clip'}
              </Button>

              <Button 
                className="w-full"
                onClick={extractClip}
                disabled={isExtracting}
              >
                {isExtracting ? 'Extracting...' : 'Extract Clip'}
              </Button>

              {isExtracting && (
                <Progress value={progress} className="w-full" />
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VideoClipExtractor;