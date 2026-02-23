import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/api';
import { User, Mail, Shield, Calendar, Clock, Save } from 'lucide-react';
import { useUnsavedChangesWarning } from '../hooks/useUnsavedChangesWarning';
import UnsavedChangesDialog from '../components/UnsavedChangesDialog';
import ResetOnboardingButton from '../components/ResetOnboardingButton';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>('');

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
      setLoading(false);
    }
  }, [user]);

  const handleSave = async () => {
    if (!user || !name.trim()) return;
    
    try {
      setSaving(true);
      setMessage('');
      
      await apiClient.updateProfile(user.id, { name: name.trim() });
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <User className="w-4 h-4 inline mr-1" />
              Full Name
            </label>
            <input 
              type="text"
              className="w-full border border-gray-300 dark:border-border rounded-lg px-3 py-2 bg-white dark:bg-secondary text-foreground focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={name} 
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder="Enter your full name"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Mail className="w-4 h-4 inline mr-1" />
                Email
              </label>
              <input 
                type="email"
                className="w-full border border-gray-300 dark:border-border rounded-lg px-3 py-2 bg-gray-50 dark:bg-secondary text-foreground"
                value={user?.email || ''}
                disabled
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Shield className="w-4 h-4 inline mr-1" />
                Role
              </label>
              <input 
                type="text"
                className="w-full border border-gray-300 dark:border-border rounded-lg px-3 py-2 bg-gray-50 dark:bg-secondary text-foreground capitalize"
                value={user?.role || ''}
                disabled
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Role is assigned by administration</p>
            </div>
          </div>

          {user?.student_id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Student ID
              </label>
              <input 
                type="text"
                className="w-full border border-gray-300 dark:border-border rounded-lg px-3 py-2 bg-gray-50 dark:bg-secondary text-foreground"
                value={user.student_id}
                disabled
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Account Created
              </label>
              <input 
                type="text"
                className="w-full border border-gray-300 dark:border-border rounded-lg px-3 py-2 bg-gray-50 dark:bg-secondary text-foreground"
                value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                disabled
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                Total Study Time
              </label>
              <input 
                type="text"
                className="w-full border border-gray-300 dark:border-border rounded-lg px-3 py-2 bg-gray-50 dark:bg-secondary text-foreground"
                value={`${Math.round((user?.total_study_time_minutes || 0) / 60)} hours`}
                disabled
              />
            </div>
          </div>

          {message && (
            <div className={`p-3 rounded-lg text-sm ${
              message.includes('success') 
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800' 
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
            }`}>
              {message}
            </div>
          )}
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


