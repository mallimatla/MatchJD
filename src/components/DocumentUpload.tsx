'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { firebaseStorage, firebaseDb, firebaseAuth } from '@/lib/firebase';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface UploadedFile {
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'complete' | 'error';
  progress: number;
  documentId?: string;
  error?: string;
}

interface DocumentUploadProps {
  projectId: string;
  onUploadComplete?: (documentId: string) => void;
}

export function DocumentUpload({ projectId, onUploadComplete }: DocumentUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => ({
      file,
      status: 'pending' as const,
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.tiff'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    const user = firebaseAuth.currentUser;
    if (!user) return;

    setIsUploading(true);

    for (let i = 0; i < files.length; i++) {
      const uploadedFile = files[i];
      if (uploadedFile.status !== 'pending') continue;

      try {
        // Update status to uploading
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: 'uploading' as const, progress: 10 } : f
          )
        );

        // Create document record in Firestore first
        const docRef = await addDoc(collection(firebaseDb, 'documents'), {
          projectId,
          tenantId: user.uid,
          filename: uploadedFile.file.name,
          status: 'uploading',
          category: null,
          extractedData: null,
          confidence: 0,
          requiresReview: false,
          reviewReasons: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Upload to Firebase Storage
        const storageRef = ref(
          firebaseStorage,
          `documents/${user.uid}/${projectId}/${docRef.id}/${uploadedFile.file.name}`
        );

        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, progress: 30 } : f
          )
        );

        await uploadBytes(storageRef, uploadedFile.file);
        const downloadUrl = await getDownloadURL(storageRef);

        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, progress: 60, status: 'processing' as const } : f
          )
        );

        // Update document with storage URL and trigger processing
        await updateDoc(doc(firebaseDb, 'documents', docRef.id), {
          storageUrl: downloadUrl,
          status: 'processing',
          updatedAt: new Date(),
        });

        // Update status to complete
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i
              ? { ...f, status: 'complete' as const, progress: 100, documentId: docRef.id }
              : f
          )
        );

        onUploadComplete?.(docRef.id);
      } catch (error: any) {
        console.error('Upload error:', error);
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i
              ? { ...f, status: 'error' as const, error: error.message }
              : f
          )
        );
      }
    }

    setIsUploading(false);
  };

  const pendingFiles = files.filter((f) => f.status === 'pending');
  const hasCompleted = files.some((f) => f.status === 'complete');

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-gray-300 hover:border-gray-400'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="w-10 h-10 mx-auto text-gray-400 mb-4" />
        {isDragActive ? (
          <p className="text-primary font-medium">Drop files here...</p>
        ) : (
          <>
            <p className="font-medium text-gray-700">
              Drag & drop documents here, or click to select
            </p>
            <p className="text-sm text-gray-500 mt-1">
              PDF, DOC, DOCX, images up to 50MB
            </p>
          </>
        )}
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((uploadedFile, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
            >
              <File className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">
                  {uploadedFile.file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {(uploadedFile.file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                {uploadedFile.status === 'uploading' && (
                  <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                    <div
                      className="bg-primary h-1 rounded-full transition-all"
                      style={{ width: `${uploadedFile.progress}%` }}
                    />
                  </div>
                )}
                {uploadedFile.error && (
                  <p className="text-xs text-red-500 mt-1">{uploadedFile.error}</p>
                )}
              </div>
              <div className="flex-shrink-0">
                {uploadedFile.status === 'pending' && (
                  <button
                    onClick={() => removeFile(index)}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                )}
                {(uploadedFile.status === 'uploading' || uploadedFile.status === 'processing') && (
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                )}
                {uploadedFile.status === 'complete' && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
                {uploadedFile.status === 'error' && (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {pendingFiles.length > 0 && (
        <Button
          onClick={uploadFiles}
          disabled={isUploading}
          className="w-full"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload {pendingFiles.length} file{pendingFiles.length > 1 ? 's' : ''}
            </>
          )}
        </Button>
      )}

      {/* Clear completed */}
      {hasCompleted && !isUploading && (
        <Button
          variant="outline"
          onClick={() => setFiles((prev) => prev.filter((f) => f.status !== 'complete'))}
          className="w-full"
        >
          Clear completed
        </Button>
      )}
    </div>
  );
}
