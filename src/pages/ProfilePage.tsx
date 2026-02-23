import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/api';
import { User, Mail, Shield, Calendar, Clock, Save, BellOff } from 'lucide-react';
import { useUnsavedChangesWarning } from '../hooks/useUnsavedChangesWarning';
import UnsavedChangesDialog from '../components/UnsavedChangesDialog';
import ResetOnboardingButton from '../components/ResetOnboardingButton';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [noSubstitutions, setNoSubstitutions] = useState(false);
  const [savingPref, setSavingPref] = useState(false);

  // Track if name was changed
  const hasUnsavedChanges = user ? name !== user.name && name.trim() !== '' : false;

  // Unsaved changes warning
  const { confirmLeave, cancelLeave, isBlocked } = useUnsavedChangesWarning({
    hasUnsavedChanges,
    message: 'You have unsaved changes to your profile. Are you sure you want to leave?',
    onConfirmLeave: () => {
      // Reset name to original value
      if (user) setName(user.name || '');
    }
  });

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setNoSubstitutions((user as any).no_substitutions || false);
      setLoading(false);
    }
  }, [user]);

  const handleSave = async () => {
    if (!user || !name.trim()) return;
    
    try {
      setSaving(true);
      setMessage('');
      
      await apiClient.updateProfile(user.id as any, { name: name.trim() });
      setMessage('Profile updated successfully!');
      
      // Refresh user data in context
      await refreshUser();
    } catch (error) {
      setMessage('Failed to update profile. Please try again.');
      console.error('Failed to update profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSubstitutions = async () => {
    try {
      setSavingPref(true);
      const newVal = !noSubstitutions;
      await apiClient.updateSubstitutionPreference(newVal);
      setNoSubstitutions(newVal);
      await refreshUser();
    } catch (error) {
      console.error('Failed to update substitution preference:', error);
    } finally {
      setSavingPref(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-6"></div>
          <div className="bg-white dark:bg-card rounded-2xl shadow-card p-6 max-w-2xl">
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-28"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Profile</h1>
        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
          <Clock className="w-4 h-4 mr-1" />
          Last updated: {new Date().toLocaleDateString()}
        </div>
      </div>

      <div className="bg-white dark:bg-card rounded-2xl shadow-card p-6 max-w-2xl">
        <div className="flex items-center mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-semibold mr-4">
            {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{user?.name}</h2>
            <p className="text-gray-600 dark:text-gray-300 capitalize">{user?.role}</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 inline mr-1" />
              Full Name
            </label>
            <input 
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={name} 
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder="Enter your full name"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Mail className="w-4 h-4 inline mr-1" />
                Email
              </label>
              <input 
                type="email"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                value={user?.email || ''}
                disabled
              />
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Shield className="w-4 h-4 inline mr-1" />
                Role
              </label>
              <input 
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 capitalize"
                value={user?.role || ''}
                disabled
              />
              <p className="text-xs text-gray-500 mt-1">Role is assigned by administration</p>
            </div>
          </div>

          {user?.student_id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Student ID
              </label>
              <input 
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                value={user.student_id}
                disabled
              />
            </div>
          )}

          {/* Teacher Substitution Preference */}
          {user?.role === 'teacher' && (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BellOff className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">Hide from substitution requests</p>
                    <p className="text-sm text-gray-500">
                      When enabled, other teachers will not see you as available for substitutions
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleToggleSubstitutions}
                  disabled={savingPref}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    noSubstitutions ? 'bg-blue-600' : 'bg-gray-300'
                  } ${savingPref ? 'opacity-50 cursor-wait' : ''}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      noSubstitutions ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Account Created
              </label>
              <input 
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                disabled
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                Total Study Time
              </label>
              <input 
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                value={`${Math.round((user?.total_study_time_minutes || 0) / 60)} hours`}
                disabled
              />
            </div>
          </div>

          {message && (
            <div className={`p-3 rounded-lg text-sm ${
              message.includes('success') 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t">
            <button
              onClick={handleSave}
              disabled={saving || !name.trim() || name === user?.name}
              className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Unsaved Changes Warning Dialog */}
      <UnsavedChangesDialog
        open={isBlocked}
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
        title="Unsaved Profile Changes"
        description="You have unsaved changes to your profile. Are you sure you want to leave? Your changes will be lost."
      />
    </div>
  );
}


