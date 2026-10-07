import { useState, useEffect } from 'react';
import UserAvatar from '@/components/mascot/UserAvatar';
import OrcaBuilder from '@/components/mascot/OrcaBuilder';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/api';
import { User, Mail, Shield, Calendar, Clock, Save, BellOff } from 'lucide-react';
import { useUnsavedChangesWarning } from '../hooks/useUnsavedChangesWarning';
import UnsavedChangesDialog from '../components/UnsavedChangesDialog';
import { roleLabel } from '@/lib/roleLabel';
import { formatDate } from '@/lib/i18n';

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
          <div className="h-8 bg-gray-200 dark:bg-secondary rounded w-32 mb-6"></div>
          <div className="bg-card rounded-2xl shadow-card p-6 max-w-2xl">
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 dark:bg-secondary rounded w-24"></div>
              <div className="h-10 bg-gray-200 dark:bg-secondary rounded"></div>
              <div className="h-4 bg-gray-200 dark:bg-secondary rounded w-32"></div>
              <div className="h-4 bg-gray-200 dark:bg-secondary rounded w-28"></div>
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
        <div className="flex items-center text-sm text-muted-foreground">
          <Clock className="w-4 h-4 mr-1" />
          Last updated: {formatDate(Date.now())}
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-card p-6 max-w-2xl">
        <div className="flex items-center mb-6">
          <UserAvatar
            userId={user?.id}
            name={user?.name}
            avatarUrl={user?.avatar_url}
            mascot={user?.mascot}
            isStudent={user?.role === 'student'}
            size={64}
            className="mr-4"
          />
          <div>
            <h2 className="text-xl font-semibold text-foreground">{user?.name}</h2>
            <p className="text-muted-foreground">{roleLabel(user?.role)}</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-2">
              <User className="w-4 h-4 inline mr-1" />
              Full Name
            </label>
            <input 
              type="text"
              className="w-full border border-gray-300 dark:border-border rounded-lg px-3 py-2 bg-white dark:bg-secondary text-foreground focus:ring-2 focus:ring-ring focus:border-ring"
              value={name} 
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder="Enter your full name"
            />
          </div>

          <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-2">
                <Mail className="w-4 h-4 inline mr-1" />
                Email
              </label>
              <input 
                type="email"
                className="w-full border border-gray-300 dark:border-border rounded-lg px-3 py-2 bg-muted text-foreground"
                value={user?.email || ''}
                disabled
              />
              <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-2">
                <Shield className="w-4 h-4 inline mr-1" />
                Role
              </label>
              <input 
                type="text"
                className="w-full border border-gray-300 dark:border-border rounded-lg px-3 py-2 bg-muted text-foreground capitalize"
                value={user?.role || ''}
                disabled
              />
              <p className="text-xs text-muted-foreground mt-1">Role is assigned by administration</p>
            </div>
          </div>

          {user?.student_id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-2">
                Student ID
              </label>
              <input 
                type="text"
                className="w-full border border-gray-300 dark:border-border rounded-lg px-3 py-2 bg-muted text-foreground"
                value={user.student_id}
                disabled
              />
            </div>
          )}

          {/* Teacher Substitution Preference */}
          {user?.role === 'teacher' && (
            <div className="p-4 bg-muted rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BellOff className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Hide from substitution requests</p>
                    <p className="text-sm text-muted-foreground">
                      When enabled, other teachers will not see you as available for substitutions
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleToggleSubstitutions}
                  disabled={savingPref}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                    noSubstitutions ? 'bg-brand-solid' : 'bg-gray-300 dark:bg-secondary'
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

          <div className="grid grid-cols-1 @2xl:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Account Created
              </label>
              <input 
                type="text"
                className="w-full border border-gray-300 dark:border-border rounded-lg px-3 py-2 bg-muted text-foreground"
                value={user?.created_at ? formatDate(user.created_at) : 'Unknown'}
                disabled
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-foreground mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                Total Study Time
              </label>
              <input 
                type="text"
                className="w-full border border-gray-300 dark:border-border rounded-lg px-3 py-2 bg-muted text-foreground"
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

          <div className="flex justify-between items-center pt-4 border-t dark:border-border">
            <button
              onClick={handleSave}
              disabled={saving || !name.trim() || name === user?.name}
              className="flex items-center px-6 py-2 bg-brand-solid text-brand-solid-foreground rounded-lg hover:bg-brand-solid-hover disabled:bg-gray-400 dark:disabled:bg-secondary dark:disabled:text-muted-foreground disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {user?.role === 'student' && <OrcaBuilder />}

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


