/**
 * The barber's verification status and document upload.
 *
 * Reads barber_profile.verification_status and the barber's own
 * verification_requests row (both RLS-verified own-row reads). Everything is
 * DISPLAY-ONLY: verification_status is admin-owned (trigger-protected,
 * migration 0005) and no code in this app may ever write it.
 *
 * Upload picks one image (the system photo picker needs no library
 * permission), then runs the strict two-step flow: uploadVerificationDocument
 * (bytes → private bucket), then submitVerificationDocument (path → own
 * verification_requests row), and refetches only on success. A failure at
 * either step surfaces its message and never fabricates an "uploaded" state.
 */
import { useCallback, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { fetchOwnProfile } from '../../auth/authService';
import { useToast } from '../../shared/components/ToastProvider';
import type { VerificationDocType, VerificationRequestRow, VerificationStatus } from '../../types';
import { fetchOwnBarberProfile, fetchOwnVerificationRequest } from '../profileData';
import { submitVerificationDocument, uploadVerificationDocument } from '../verificationData';

export function useVerification(de: boolean) {
  const { showToast } = useToast();
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [request, setRequest] = useState<VerificationRequestRow | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<VerificationDocType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const profileResult = await fetchOwnProfile();
    if (profileResult.status === 'error' || !profileResult.profile) {
      setLoading(false);
      setError(
        profileResult.status === 'error'
          ? profileResult.message
          : de ? 'Dein Profil konnte nicht geladen werden.' : 'Could not load your profile.'
      );
      return;
    }
    const id = profileResult.profile.id;
    setUserId(id);

    const [barberProfileResult, requestResult] = await Promise.all([
      fetchOwnBarberProfile(id),
      fetchOwnVerificationRequest(id),
    ]);
    setLoading(false);
    if (barberProfileResult.status !== 'ok') {
      setError(barberProfileResult.message);
      return;
    }
    if (requestResult.status !== 'ok') {
      setError(requestResult.message);
      return;
    }
    setStatus(barberProfileResult.profile?.verification_status ?? null);
    setRequest(requestResult.request);
  }, [de]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const upload = useCallback(
    async (docType: VerificationDocType) => {
      if (!userId) {
        showToast({ message: de ? 'Dein Profil wird noch geladen. Versuch es gleich noch einmal.' : 'Your profile is still loading. Try again shortly.' });
        return;
      }
      // Belt-and-suspenders: the rows are already disabled while a doc uploads.
      if (uploadingDoc) return;

      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (result.canceled) return;
      const asset = result.assets[0];

      setUploadingDoc(docType);
      try {
        const failed = de ? 'Upload fehlgeschlagen.' : 'Upload failed.';
        const uploaded = await uploadVerificationDocument(userId, docType, asset.uri);
        if (uploaded.status !== 'ok') {
          showToast({ message: `${failed} ${uploaded.message}` });
          return;
        }
        const submitted = await submitVerificationDocument(userId, docType, uploaded.path);
        if (submitted.status !== 'ok') {
          showToast({ message: `${failed} ${submitted.message}` });
          return;
        }
        await load();
      } finally {
        setUploadingDoc(null);
      }
    },
    [userId, uploadingDoc, load, de, showToast]
  );

  return { status, request, uploadingDoc, loading, error, load, upload };
}
