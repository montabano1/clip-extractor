import { NextResponse } from 'next/server';
import s3 from '@/lib/s3client';
import { PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

export async function POST(request: Request) {
  try {
    const { fileName, fileContent } = await request.json();

    if (!fileName || !fileContent) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // The fileName already includes the shot type folder
    // e.g., "fym/video_title_10-12.mp4"
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: `clips/${fileName}`, // This will create the folder structure automatically
      Body: Buffer.from(fileContent, 'base64'),
      ContentType: 'video/mp4',
    };

    const command = new PutObjectCommand(params);
    const result = await s3.send(command);

    return NextResponse.json({ 
      message: "Upload successful", 
      result 
    });
    
  } catch (error) {
    console.error("S3 Upload Error:", error);
    return NextResponse.json(
      { error: "Failed to upload to S3" },
      { status: 500 }
    );
  }
}