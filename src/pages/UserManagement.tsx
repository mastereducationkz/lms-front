import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/api';
import { toggleCuratorAnalyticsHidden, provisionUserToPlatform } from '../services/api/admin';
import { getRecordingTeacher } from '../services/api/recordingsAdmin';
import { toast } from '../components/Toast';
import type { User, CreateUserRequest, UpdateUserRequest, UpdateGroupRequest, Group, Course, GroupType, CourseType } from '../types';

const GROUP_TYPE_LABELS: Record<GroupType, MessageKey> = {
  group: 'adminUsers.groupType.group',
  individual: 'adminUsers.groupType.individual',
}

const COURSE_TYPE_LABELS: Record<CourseType, string> = {
  sat: 'SAT',
  ielts: 'IELTS',
  general_english: 'General English',
  nuet: 'NUET',
}

/** Если в БД course_type = general_english, но в названии есть IELTS/SAT/NUET — показываем и подставляем программу по названию */
const inferCourseTypeFromTitle = (title: string): CourseType | null => {
  const t = title.trim()
  if (!t) return null
  if (/\bielts\b/i.test(t)) return 'ielts'
  if (/\bnuet\b/i.test(t)) return 'nuet'
  if (/\bsat\b/i.test(t)) return 'sat'
  return null
}

const getEffectiveCourseType = (course: Pick<Course, 'title' | 'course_type'>): CourseType => {
  const stored = course.course_type as CourseType | undefined
  if (stored === 'sat' || stored === 'ielts' || stored === 'nuet') return stored
  const inferred = inferCourseTypeFromTitle(course.title || '')
  if (inferred) return inferred
  return 'general_english'
}

const formatCourseOptionLabel = (course: Course) => {
  const effective = getEffectiveCourseType(course)
  const tag = COURSE_TYPE_LABELS[effective] ? ` [${COURSE_TYPE_LABELS[effective]}]` : ''
  return `${course.title}${tag}`
}
import { 
  Users, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  UserPlus,
  RefreshCw,
  Upload,
  Copy,
  MoreHorizontal,
  Calendar as CalendarIcon,
  Check,
  X
} from 'lucide-react';
import ScheduleGenerator from '../components/ScheduleGenerator';
import Loader from '../components/Loader';
import Modal from '../components/Modal';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { UsersTable } from '../components/users/UsersTable';
import { BulkActionsBar } from '../components/users/BulkActionsBar';
import { AddToGroupDialog } from '../components/users/AddToGroupDialog';
import { teacherGroupTail } from '../lib/groupNames';
import { passwordHint, passwordPolicyError } from '../lib/passwordPolicy';
import { roleLabel } from '../lib/roleLabel';
import { useT } from '../lib/i18n/react';
import type { MessageKey } from '../lib/i18n';
import '@/lib/i18n/catalogs/users';
import '@/lib/i18n/catalogs/adminUsers';
import '@/lib/i18n/catalogs/offboarding';
import { useOffboardLauncher } from '../components/offboarding/useOffboardLauncher';
import { STAFF_ROLES } from '../lib/offboarding';

/** A translated sentence with its <b>…</b> spans shown in bold. */
const withBold = (message: string) =>
  message.split(/<\/?b>/).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));

interface UserFormData {
  name: string;
  email: string;
  role: 'student' | 'teacher' | 'curator' | 'admin' | 'head_curator' | 'head_teacher' | 'parent';
  student_id?: string;
  password?: string;
  is_active: boolean;
  group_ids: number[]; // Multiple groups for students
  course_ids: number[]; // Multiple courses for head teachers
  child_ids: number[]; // Linked students when role === 'parent'
  workspace_email?: string; // @mastereducation.kz account — connects teachers to recordings
  personal_email?: string; // contact/recovery address, admin only, never a sign-in
}

interface GroupFormData {
  name: string;
  description?: string;
  teacher_id: number;
  curator_id?: number;
  course_id?: number; // Курс, к которому привязана группа
  student_ids: number[];
  is_active: boolean;
  is_special: boolean;
  /** Групповая по умолчанию */
  group_type: GroupType;
  /** SAT / IELTS / General English — в БД для поиска (`program_type`) */
  program_type: CourseType;
  /** First N lessons open for special groups with a course (default 1 on backend) */
  max_open_lessons: number;
}

interface GroupWithDetails extends Group {
  teacher_name?: string;
  curator_name?: string;
  students?: User[];
}

const sameIdSet = (a: number[], b: number[]) => {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort((x, y) => x - y)
  const sortedB = [...b].sort((x, y) => x - y)
  return sortedA.every((value, index) => value === sortedB[index])
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const isHeadCurator = currentUser?.role === 'head_curator';
  const isAdmin = currentUser?.role === 'admin';
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<GroupWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') || 'student');
  const [groupFilter, setGroupFilter] = useState(searchParams.get('group_id') || 'all');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('is_active') || 'all');
  const [trialFilter, setTrialFilter] = useState(searchParams.get('is_trial') || 'all');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [groupStatusFilter, setGroupStatusFilter] = useState<'all' | 'true' | 'false'>('true'); // Default to active groups
  const [groupSearch, setGroupSearch] = useState('');
  const [groupProgramFilter, setGroupProgramFilter] = useState<'all' | CourseType>('all')

  // Debounced search (network fires on this; URL/input update immediately)
  const debouncedSearch = useDebouncedValue(searchQuery, 350);

  // Unfiltered group id → name map (resolves names even for inactive groups)
  const [allGroupsById, setAllGroupsById] = useState<Map<number, string>>(new Map());

  // Multi-select (current page) + bulk add-to-group dialog
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkAddToGroup, setShowBulkAddToGroup] = useState(false);

  // Teachers and curators for group creation
  const [teachers, setTeachers] = useState<User[]>([]);
  const [curators, setCurators] = useState<User[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sendInviteOnCreate, setSendInviteOnCreate] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showCreateSpecialGroupModal, setShowCreateSpecialGroupModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [provisioningIds, setProvisioningIds] = useState<Set<number>>(new Set());
  const [selectedGroup, setSelectedGroup] = useState<GroupWithDetails | null>(null);
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [bulkAddFormData, setBulkAddFormData] = useState<{ groupId: number | null; studentIds: number[] }>({
    groupId: null,
    studentIds: []
  });
  
  // Schedule Generator State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleGroupId, setScheduleGroupId] = useState<number | null>(null);
  
  // Generated password modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  
  // Bulk text upload state
  const [showBulkTextModal, setShowBulkTextModal] = useState(false);
  const [bulkTextFormData, setBulkTextFormData] = useState<{ text: string; groupIds: number[]; sendInvites: boolean }>({
    text: '',
    groupIds: [],
    sendInvites: true
  });
  const [bulkTextResults, setBulkTextResults] = useState<{
    created: Array<{ user: User; generated_password?: string }>;
    failed: Array<{ email: string; error: string }>;
  } | null>(null);
  const [isBulkTextLoading, setIsBulkTextLoading] = useState(false);
  
  // Bulk schedule upload state
  const [showBulkScheduleModal, setShowBulkScheduleModal] = useState(false);
  const [bulkScheduleText, setBulkScheduleText] = useState('');
  const [isBulkScheduleLoading, setIsBulkScheduleLoading] = useState(false);

  const handleBulkScheduleUpload = async () => {
    if (!bulkScheduleText.trim()) {
      toast(t('adminUsers.bulkSchedule.empty'), 'error');
      return;
    }

    setIsBulkScheduleLoading(true);
    try {
      const result = await apiClient.bulkScheduleUpload(bulkScheduleText);
      toast(t('adminUsers.bulkSchedule.created', { count: result.created_groups.length }), 'success');
      if (result.failed_lines.length > 0) {
        console.error('Bulk upload failed lines:', result.failed_lines);
        // Show failed lines in a toast or modal
        const failedMessages = result.failed_lines.map((f: any) => t('adminUsers.bulkSchedule.line', { line: f.line_num, error: f.error })).join('\n');
        toast(t('adminUsers.bulkSchedule.partial', { count: result.created_groups.length, lines: failedMessages }), 'error');
      }
      setShowBulkScheduleModal(false);
      setBulkScheduleText('');
      loadGroups();
    } catch (e: any) {
      toast(e.message || t('adminUsers.bulkSchedule.failed'), 'error');
    } finally {
      setIsBulkScheduleLoading(false);
    }
  };

  const handleBulkAddStudents = async () => {
    if (!bulkAddFormData.groupId) {
      toast(t('adminUsers.bulkAdd.selectGroup'), 'error');
      return;
    }
    if (bulkAddFormData.studentIds.length === 0) {
      toast(t('adminUsers.bulkAdd.selectStudent'), 'error');
      return;
    }

    try {
      await apiClient.bulkAddStudentsToGroup(bulkAddFormData.groupId, bulkAddFormData.studentIds);
      toast(t('adminUsers.bulkAdd.done'), 'success');
      setShowBulkAddModal(false);
      setBulkAddFormData({ groupId: null, studentIds: [] });
      loadGroups(); // Refresh groups to show updated counts
    } catch (error) {
      console.error('Failed to bulk add students:', error);
      toast(t('adminUsers.bulkAdd.failed'), 'error');
    }
  };

  const handleBulkTextUpload = async () => {
    if (!bulkTextFormData.text.trim()) {
      toast(t('adminUsers.bulkText.empty'), 'error');
      return;
    }

    setIsBulkTextLoading(true);
    setBulkTextResults(null);

    try {
      const result = await apiClient.bulkCreateUsersFromText(
        bulkTextFormData.text,
        bulkTextFormData.groupIds.length > 0 ? bulkTextFormData.groupIds : undefined,
        'student',
        bulkTextFormData.sendInvites
      );
      
      setBulkTextResults({
        created: result.created_users,
        failed: result.failed_users
      });

      if (result.created_users.length > 0) {
        toast(t('adminUsers.bulkText.created', { count: result.created_users.length }), 'success');
        loadUsers();
        loadGroups();
      }
      
      if (result.failed_users.length > 0 && result.created_users.length === 0) {
        toast(t('adminUsers.bulkText.allFailed'), 'error');
      }
    } catch (error: any) {
      console.error('Failed to bulk create students:', error);
      toast(error.message || t('adminUsers.bulkText.failed'), 'error');
    } finally {
      setIsBulkTextLoading(false);
    }
  };

  const resetBulkTextForm = () => {
    setBulkTextFormData({ text: '', groupIds: [], sendInvites: true });
    setBulkTextResults(null);
  };
  
  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    email: '',
    role: 'student',
    student_id: '',
    password: '',
    is_active: true,
    group_ids: [],
    course_ids: [],
    child_ids: []
  });

  const [groupFormData, setGroupFormData] = useState<GroupFormData>({
    name: '',
    description: '',
    teacher_id: 0,
    curator_id: undefined,
    course_id: undefined,
    student_ids: [],
    is_active: true,
    is_special: false,
    group_type: 'group',
    program_type: 'general_english',
    max_open_lessons: 1
  });

  const [editGroupFormData, setEditGroupFormData] = useState<GroupFormData>({
    name: '',
    description: '',
    teacher_id: 0,
    curator_id: undefined,
    course_id: undefined,
    student_ids: [],
    is_active: true,
    is_special: false,
    group_type: 'group',
    program_type: 'general_english',
    max_open_lessons: 1
  });

  const [specialGroupFormData, setSpecialGroupFormData] = useState<GroupFormData>({
    name: '',
    description: '',
    teacher_id: 0,
    curator_id: undefined,
    course_id: undefined,
    student_ids: [],
    is_active: true,
    is_special: true,
    group_type: 'group',
    program_type: 'general_english',
    max_open_lessons: 1
  });

  // Form validation errors
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [groupFormErrors, setGroupFormErrors] = useState<{ [key: string]: string }>({});
  const [specialGroupFormErrors, setSpecialGroupFormErrors] = useState<{ [key: string]: string }>({});
  const [editGroupFormErrors, setEditGroupFormErrors] = useState<{ [key: string]: string }>({});
  const [originalEditGroupStudentIds, setOriginalEditGroupStudentIds] = useState<number[]>([]);
  const [originalUserGroupIds, setOriginalUserGroupIds] = useState<number[]>([]);
  const [originalChildIds, setOriginalChildIds] = useState<number[]>([]);
  const [originalWorkspaceEmail, setOriginalWorkspaceEmail] = useState('');
  const [originalPersonalEmail, setOriginalPersonalEmail] = useState('');

  // When auth loads and user is head_curator, lock filters and form to curator role
  useEffect(() => {
    if (isHeadCurator) {
      setRoleFilter('curator')
      setFormData(prev => ({ ...prev, role: 'curator' }))
    }
  }, [isHeadCurator])

  useEffect(() => {
    loadUsers()
    loadGroups()
  }, [currentPage, roleFilter, groupFilter, statusFilter, trialFilter, debouncedSearch])

  // Clear page selection whenever the visible set changes
  useEffect(() => {
    setSelectedIds(new Set())
  }, [currentPage, roleFilter, groupFilter, statusFilter, trialFilter, debouncedSearch])

  useEffect(() => {
    loadTeachersAndCurators();
    loadCourses();
    loadAllGroupsMap();
  }, []);

  // Reload groups when group status or program filter changes
  useEffect(() => {
    loadGroups();
  }, [groupStatusFilter, groupProgramFilter]);

  // Update URL params when role filter changes to student by default
  useEffect(() => {
    if (!searchParams.get('role') && roleFilter === 'student') {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('role', 'student');
      setSearchParams(newParams);
    }
  }, [roleFilter, searchParams, setSearchParams]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = {
        skip: (currentPage - 1) * pageSize,
        limit: pageSize,
        role: roleFilter && roleFilter !== 'all' ? roleFilter : undefined,
        group_id: groupFilter && groupFilter !== 'all' ? parseInt(groupFilter) : undefined,
        is_active: statusFilter && statusFilter !== 'all' ? statusFilter === 'true' : undefined,
        is_trial: trialFilter === 'true' ? true : undefined,
        search: searchQuery || undefined
      };

      const response = await apiClient.getUsers(params);
      const usersData = Array.isArray(response) ? response : (response.users || []);
      const sortedUsers = [...usersData].sort((a: User, b: User) =>
        (a.name || a.full_name || '').localeCompare(b.name || b.full_name || '', 'ru')
      );
      setUsers(sortedUsers);
      setTotalUsers(response.total || usersData.length);
    } catch (error) {
      console.error('Failed to load users:', error);
      setError(t('adminUsers.list.loadFailed'));
      setUsers([]);
      setTotalUsers(0);
      toast(t('adminUsers.list.loadFailed'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      const groupsData = await apiClient.getGroups(
        groupProgramFilter === 'all' ? undefined : { program_type: groupProgramFilter }
      );
      console.log('Groups data:', groupsData);
      
      // Filter groups by status
      let filteredGroups = groupsData || [];
      if (groupStatusFilter !== 'all') {
        const isActive = groupStatusFilter === 'true';
        filteredGroups = filteredGroups.filter((g: Group) => g.is_active === isActive);
      }
      
      // Sort groups by name alphabetically to maintain stable order
      const sortedGroups = filteredGroups.sort((a: Group, b: Group) => 
        a.name.localeCompare(b.name, 'ru')
      );
      
      setGroups(sortedGroups);
    } catch (error) {
      console.error('Failed to load groups:', error);
      setGroups([]);
    }
  };

  const loadCourses = async () => {
    try {
      const coursesData = await apiClient.getCourses();
      setCourses(coursesData);
    } catch (error) {
      console.error('Failed to load courses:', error);
      setCourses([]);
    }
  };

  // Unfiltered groups (all statuses/programs) → id→name map for the Groups column
  const loadAllGroupsMap = async () => {
    try {
      const all = await apiClient.getGroups();
      setAllGroupsById(new Map((all || []).map((g: Group) => [g.id, g.name])));
    } catch (error) {
      console.error('Failed to load groups map:', error);
    }
  };

  // ── Multi-select helpers ───────────────────────────────────────────────────
  const toggleSelect = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };
  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(users.map((u) => Number(u.id))) : new Set());
  };

  const handleBulkSetActive = async (isActive: boolean) => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const { ok, failed } = await apiClient.bulkSetUsersActive(ids, isActive);
    toast(
      failed === 0
        ? t(isActive ? 'users.bulk.activated' : 'users.bulk.deactivated', { count: ok })
        : t('users.bulk.partial', { ok, failed }),
      failed === 0 ? 'success' : 'error',
    );
    setSelectedIds(new Set());
    loadUsers();
  };

  const allGroupsList = React.useMemo(
    () => [...allGroupsById.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [allGroupsById],
  );

  const sortUsersByName = (list: User[]) =>
    [...list].sort((a, b) =>
      (a.name || a.full_name || '').localeCompare(b.name || b.full_name || '', 'ru')
    );

  const loadTeachersAndCurators = async () => {
    try {
      const [teachersList, curatorsList, studentsResponse] = await Promise.all([
        apiClient.getAllTeachers(),
        apiClient.getAllCurators(),
        apiClient.getUsers({ role: 'student', limit: 1000, is_active: true }),
      ]);
      const studentsList = Array.isArray(studentsResponse)
        ? studentsResponse
        : studentsResponse.users || [];

      setTeachers(sortUsersByName(teachersList.filter((user: User) => user.is_active)));
      setCurators(sortUsersByName(curatorsList.filter((user: User) => user.is_active)));
      setStudents(sortUsersByName(studentsList));
    } catch (error) {
      console.error('Failed to load teachers and curators:', error);
      setTeachers([]);
      setCurators([]);
      setStudents([]);
    }
  };

  const handleFilterChange = (filter: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value && value !== 'all') {
      newParams.set(filter, value);
    } else {
      newParams.delete(filter);
    }
    setSearchParams(newParams);
    setCurrentPage(1);
  };

  const defaultRole = isHeadCurator ? 'curator' : 'all';
  const activeFilterChips = [
    searchQuery.trim() ? { key: 'search', label: t('users.filter.search', { query: searchQuery.trim() }), clear: () => { setSearchQuery(''); handleFilterChange('search', ''); } } : null,
    !isHeadCurator && roleFilter !== 'all' ? { key: 'role', label: t('users.filter.role', { role: roleLabel(roleFilter) }), clear: () => { setRoleFilter('all'); handleFilterChange('role', 'all'); } } : null,
    groupFilter !== 'all' ? { key: 'group', label: t('users.filter.group', { group: allGroupsById.get(Number(groupFilter)) || groupFilter }), clear: () => { setGroupFilter('all'); handleFilterChange('group_id', 'all'); } } : null,
    statusFilter !== 'all' ? { key: 'status', label: t(statusFilter === 'true' ? 'users.filter.statusActive' : 'users.filter.statusInactive'), clear: () => { setStatusFilter('all'); handleFilterChange('is_active', 'all'); } } : null,
    trialFilter === 'true' ? { key: 'trial', label: t('users.filter.trialOnly'), clear: () => { setTrialFilter('all'); handleFilterChange('is_trial', 'all'); } } : null,
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  const clearAllFilters = () => {
    setSearchQuery('');
    setGroupFilter('all');
    setStatusFilter('all');
    setTrialFilter('all');
    if (!isHeadCurator) setRoleFilter(defaultRole);
    setCurrentPage(1);
    const newParams = new URLSearchParams(searchParams);
    ['search', 'group_id', 'is_active', 'is_trial'].forEach((k) => newParams.delete(k));
    if (!isHeadCurator) newParams.delete('role');
    setSearchParams(newParams);
  };

  const validateForm = (): { [key: string]: string } => {
    const errors: { [key: string]: string } = {};
    
    if (!formData.name.trim()) {
      errors.name = t('adminUsers.form.nameRequired');
    }
    if (!formData.email.trim()) {
      errors.email = t('adminUsers.form.emailRequired');
    } else {
      // Простая валидация email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        errors.email = t('adminUsers.form.emailInvalid');
      }
    }

    // Password is optional (empty = keep current / auto-generate on create), but when
    // provided it must satisfy the backend policy (src/lib/passwordPolicy).
    if (formData.password) {
      const passwordError = passwordPolicyError(formData.password);
      if (passwordError) errors.password = passwordError;
    }

    const personalEmail = (formData.personal_email || '').trim();
    if (personalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail)) {
      errors.personal_email = t('adminUsers.form.emailInvalid');
    }

    const workspaceEmail = (formData.workspace_email || '').trim();
    if (workspaceEmail && !workspaceEmail.endsWith('@mastereducation.kz')) {
      errors.workspace_email = t('adminUsers.form.workspaceDomain');
    }

    return errors;
  };

  const validateCreateGroupForm = (data: GroupFormData): { [key: string]: string } => {
    const errors: { [key: string]: string } = {};

    if (!data.name.trim()) {
      errors.name = t('adminUsers.groupForm.nameRequired');
    }
    if (!data.course_id) {
      errors.course_id = t('adminUsers.groupForm.courseRequired');
    }
    if (data.is_special) {
      if (!data.curator_id) {
        errors.curator_id = t('adminUsers.groupForm.curatorRequired');
      }
      if (data.course_id && data.max_open_lessons < 1) {
        errors.max_open_lessons = t('adminUsers.groupForm.minOne');
      }
    } else if (!data.teacher_id) {
      errors.teacher_id = t('adminUsers.groupForm.teacherRequired');
    }

    return errors;
  };

  const validateEditGroupForm = (): { [key: string]: string } => {
    const errors: { [key: string]: string } = {};
    
    if (!editGroupFormData.name.trim()) {
      errors.name = t('adminUsers.groupForm.nameRequired');
    }
    if (editGroupFormData.is_special) {
      if (!editGroupFormData.curator_id) {
        errors.curator_id = t('adminUsers.groupForm.curatorRequired');
      }
      if (editGroupFormData.course_id && editGroupFormData.max_open_lessons < 1) {
        errors.max_open_lessons = t('adminUsers.groupForm.minOne');
      }
    } else if (!editGroupFormData.teacher_id) {
      errors.teacher_id = t('adminUsers.groupForm.teacherRequired');
    }
    
    return errors;
  };

  const handleCreateUser = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast(t('adminUsers.form.fixErrors'), 'error');
      return;
    }
    setFormErrors({});

    try {
      const userData: CreateUserRequest = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        role: formData.role,
        student_id: formData.student_id || undefined,
        password: formData.password || undefined,
        is_active: formData.is_active,
        group_ids: formData.role === 'student' && formData.group_ids.length > 0 ? formData.group_ids : undefined,
        course_ids: formData.role === 'head_teacher' && formData.course_ids.length > 0 ? formData.course_ids : undefined,
        child_ids: formData.role === 'parent' && formData.child_ids.length > 0 ? formData.child_ids : undefined,
        send_invites: formData.role === 'student' ? sendInviteOnCreate : false
      };

      const newUser = await apiClient.createUser(userData);
      toast(t('adminUsers.user.created'), 'success');
      
      setShowCreateModal(false);
      resetForm();
      
      // Show password modal if password was generated
      if (newUser.generated_password) {
        setGeneratedPassword(newUser.generated_password);
        setShowPasswordModal(true);
      }
      
      loadUsers();
    } catch (error) {
      console.error('Failed to create user:', error);
      toast(t('adminUsers.user.createFailed'), 'error');
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast(t('adminUsers.form.fixErrors'), 'error');
      return;
    }
    setFormErrors({});
    
    try {
      const userData: UpdateUserRequest = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        role: formData.role,
        student_id: formData.student_id || undefined,
        password: formData.password || undefined,
        is_active: formData.is_active,
        course_ids: formData.role === 'head_teacher' ? formData.course_ids : undefined
      };

      // Only a change is sent: an untouched field must never silently disconnect a teacher
      // (e.g. when the recordings lookup failed and the input simply stayed empty).
      const nextWorkspace = (formData.workspace_email || '').trim();
      if (nextWorkspace !== originalWorkspaceEmail) {
        userData.workspace_email = nextWorkspace || null;
      }
      const nextPersonal = (formData.personal_email || '').trim();
      if (isAdmin && nextPersonal !== originalPersonalEmail) {
        userData.personal_email = nextPersonal || null;
      }

      if (
        formData.role === 'student' &&
        !sameIdSet(formData.group_ids, originalUserGroupIds)
      ) {
        userData.group_ids = formData.group_ids
      }
      
      await apiClient.updateUser(Number(selectedUser.id), userData);

      // Sync parent↔child links (add newly selected, remove unchecked).
      if (formData.role === 'parent') {
        const pid = Number(selectedUser.id);
        const added = formData.child_ids.filter((id) => !originalChildIds.includes(id));
        const removed = originalChildIds.filter((id) => !formData.child_ids.includes(id));
        if (added.length) await apiClient.linkParentChildren(pid, added);
        await Promise.all(removed.map((sid) => apiClient.unlinkParentChild(pid, sid)));
      }

      toast(t('adminUsers.user.updated'), 'success');

      setShowEditModal(false);
      resetForm();
      loadUsers();
    } catch (error: any) {
      console.error('Failed to update user:', error);
      const detail = error?.response?.data?.detail;
      toast(typeof detail === 'string' && detail ? detail : t('adminUsers.user.updateFailed'), 'error');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    try {
      await apiClient.deactivateUser(Number(selectedUser.id));
      toast(t('adminUsers.user.deactivated'), 'success');
      setShowDeleteModal(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error: any) {
      console.error('Failed to deactivate user:', error);
      const errorMessage = error.response?.data?.detail || t('adminUsers.user.deactivateFailed');
      toast(errorMessage, 'error');
    }
  };

  const handleToggleAnalyticsHidden = async (user: User) => {
    try {
      const updated = await toggleCuratorAnalyticsHidden(Number(user.id))
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_analytics_hidden: updated.is_analytics_hidden } : u))
      toast(
        updated.is_analytics_hidden
          ? t('users.analytics.hidden', { name: user.name ?? '' })
          : t('users.analytics.shown', { name: user.name ?? '' }),
        'success'
      )
    } catch (error: any) {
      toast(error.message || t('adminUsers.user.analyticsToggleFailed'), 'error')
    }
  }

  const handleProvisionPlatform = async (user: User, platform: 'ielts' | 'sat') => {
    const id = Number(user.id)
    const label = platform === 'ielts' ? 'IELTS' : 'SAT/NUET'
    setProvisioningIds(prev => new Set(prev).add(id))
    try {
      const result = await provisionUserToPlatform(id, platform)
      const created = result.outcome === 'created'
      const count = result.memberships_relinked
      const message = count > 0
        ? t(created ? 'users.provision.createdLinked' : 'users.provision.existsLinked', { platform: label, count, name: user.name ?? '' })
        : t(created ? 'users.provision.created' : 'users.provision.exists', { platform: label, name: user.name ?? '' })
      toast(message, 'success')
    } catch (error: any) {
      toast(error.message || t('users.provision.failed', { platform: label }), 'error')
    } finally {
      setProvisioningIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    
    try {
      // Instead of deleting, deactivate the group
      await apiClient.updateGroup(selectedGroup.id, { is_active: false });
      toast(t('adminUsers.group.deactivated'), 'success');
      setShowDeleteModal(false);
      setSelectedGroup(null);
      loadGroups();
      loadUsers(); // Reload users to update group information
    } catch (error) {
      console.error('Failed to deactivate group:', error);
      toast(t('adminUsers.group.deactivateFailed'), 'error');
    }
  };

  const handleCreateGroup = async () => {
    const errors = validateCreateGroupForm(groupFormData);
    if (Object.keys(errors).length > 0) {
      setGroupFormErrors(errors);
      toast(t('adminUsers.form.fixErrors'), 'error');
      return;
    }
    setGroupFormErrors({});

    try {
      const groupData = {
        name: groupFormData.name.trim(),
        description: groupFormData.description?.trim() || undefined,
        teacher_id: groupFormData.is_special
          ? (groupFormData.teacher_id > 0 ? groupFormData.teacher_id : undefined)
          : groupFormData.teacher_id,
        curator_id: groupFormData.curator_id || undefined,
        course_id: groupFormData.course_id!, // required — validateCreateGroupForm guarantees it is set
        is_active: groupFormData.is_active,
        is_special: groupFormData.is_special,
        group_type: groupFormData.group_type,
        program_type: groupFormData.program_type,
        max_open_lessons:
          groupFormData.is_special && groupFormData.course_id
            ? groupFormData.max_open_lessons
            : undefined
      };
      
      const newGroup = await apiClient.createGroup(groupData);
      toast(t('adminUsers.group.created'), 'success');
      
      // Add students to the group if any are selected
      if (groupFormData.student_ids.length > 0) {
        try {
          await apiClient.bulkAddStudentsToGroup(newGroup.id, groupFormData.student_ids);
          toast(t('adminUsers.group.createdWithStudents', { count: groupFormData.student_ids.length }), 'success');
        } catch (error) {
          console.error('Failed to add students to group:', error);
          toast(t('adminUsers.group.studentsAddFailed'), 'error');
        }
      }
      
      setShowCreateGroupModal(false);
      resetGroupForm();
      loadGroups();
      loadUsers(); // Reload users to update group information
      
      // Open Schedule Generator
      setScheduleGroupId(newGroup.id);
      setShowScheduleModal(true);
    } catch (error) {
      console.error('Failed to create group:', error);
      toast(t('adminUsers.group.createFailed'), 'error');
    }
  };

  const handleCreateSpecialGroup = async () => {
    const errors = validateCreateGroupForm(specialGroupFormData);
    if (Object.keys(errors).length > 0) {
      setSpecialGroupFormErrors(errors);
      toast(t('adminUsers.form.fixErrors'), 'error');
      return;
    }
    setSpecialGroupFormErrors({});

    try {
      const groupData = {
        name: specialGroupFormData.name.trim(),
        description: specialGroupFormData.description?.trim() || undefined,
        teacher_id:
          specialGroupFormData.teacher_id > 0 ? specialGroupFormData.teacher_id : undefined,
        curator_id: specialGroupFormData.curator_id || undefined,
        course_id: specialGroupFormData.course_id!, // required — validateCreateGroupForm guarantees it is set
        is_active: specialGroupFormData.is_active,
        is_special: true,
        group_type: specialGroupFormData.group_type,
        program_type: specialGroupFormData.program_type,
        max_open_lessons:
          specialGroupFormData.course_id ? specialGroupFormData.max_open_lessons : undefined
      };

      const newGroup = await apiClient.createGroup(groupData);
      toast(t('adminUsers.group.specialCreated'), 'success');

      if (specialGroupFormData.student_ids.length > 0) {
        try {
          await apiClient.bulkAddStudentsToGroup(newGroup.id, specialGroupFormData.student_ids);
          toast(t('adminUsers.group.studentsAdded', { count: specialGroupFormData.student_ids.length }), 'success');
        } catch (error) {
          console.error('Failed to add students to group:', error);
          toast(t('adminUsers.group.studentsAddFailed'), 'error');
        }
      }

      setShowCreateSpecialGroupModal(false);
      resetSpecialGroupForm();
      loadGroups();
      loadUsers();

      setScheduleGroupId(newGroup.id);
      setShowScheduleModal(true);
    } catch (error) {
      console.error('Failed to create special group:', error);
      toast(t('adminUsers.group.specialCreateFailed'), 'error');
    }
  };

  const handleUpdateGroup = async () => {
    if (!selectedGroup) return;
    
    const errors = validateEditGroupForm();
    if (Object.keys(errors).length > 0) {
      setEditGroupFormErrors(errors);
      toast(t('adminUsers.form.fixErrors'), 'error');
      return;
    }
    setEditGroupFormErrors({});

    try {
      const groupData: UpdateGroupRequest = {
        name: editGroupFormData.name.trim(),
        description: editGroupFormData.description?.trim() || undefined,
        teacher_id: editGroupFormData.is_special
          ? (editGroupFormData.teacher_id > 0 ? editGroupFormData.teacher_id : undefined)
          : editGroupFormData.teacher_id,
        curator_id: editGroupFormData.curator_id || undefined,
        course_id: editGroupFormData.course_id || undefined,
        is_active: editGroupFormData.is_active,
        is_special: editGroupFormData.is_special,
        group_type: editGroupFormData.group_type,
        program_type: editGroupFormData.program_type,
        max_open_lessons:
          editGroupFormData.is_special && editGroupFormData.course_id
            ? editGroupFormData.max_open_lessons
            : undefined
      };

      if (!sameIdSet(editGroupFormData.student_ids, originalEditGroupStudentIds)) {
        groupData.student_ids = editGroupFormData.student_ids
      }
      
      await apiClient.updateGroup(selectedGroup.id, groupData);
      toast(t('adminUsers.group.updated'), 'success');
      
      setShowEditGroupModal(false);
      resetEditGroupForm();
      loadGroups();
      loadUsers(); // Reload users to update group information
    } catch (error) {
      console.error('Failed to update group:', error);
      toast(t('adminUsers.group.updateFailed'), 'error');
    }
  };


  const openEditModal = async (user: User) => {
    const groupIds = user.group_ids || []
    setSelectedUser(user);
    setOriginalUserGroupIds(groupIds)

    // Preload linked children for parents so the picker reflects current state.
    let childIds: number[] = [];
    if (user.role === 'parent') {
      try {
        const kids = await apiClient.getParentChildren(Number(user.id));
        childIds = kids.map((k) => k.id);
      } catch {
        childIds = [];
      }
    }
    setOriginalChildIds(childIds);

    // The recordings connection lives on a different endpoint than the user record, so the
    // current value is fetched separately; a miss just leaves the field empty and — because
    // only diffs are submitted — can never disconnect anyone by accident.
    let workspaceEmail = '';
    if (user.role === 'teacher' || user.role === 'head_teacher') {
      try {
        workspaceEmail = (await getRecordingTeacher(Number(user.id))).workspace_email ?? '';
      } catch {
        workspaceEmail = '';
      }
    }
    setOriginalWorkspaceEmail(workspaceEmail);
    setOriginalPersonalEmail(user.personal_email ?? '');

    setFormData({
      name: user.name || user.full_name || '',
      email: user.email,
      role: user.role,
      student_id: user.student_id || '',
      password: '',
      is_active: user.is_active ?? true,
      group_ids: groupIds,
      course_ids: user.course_ids || [],
      child_ids: childIds,
      workspace_email: workspaceEmail,
      personal_email: user.personal_email ?? ''
    });
    setShowEditModal(true);
  };

  // While offboarding is on, staff leave through it: it hands over their groups and switches
  // off every system, which the old Deactivate never did (SPEC §12 Q92). Students are unchanged.
  const offboard = useOffboardLauncher(() => loadUsers());
  const offboardsInstead = (user: User) => offboard.enabled && STAFF_ROLES.has(user.role);

  const openDeleteModal = (user: User) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      role: 'student',
      student_id: '',
      password: '',
      is_active: true,
      group_ids: [],
      course_ids: [],
      child_ids: [],
      workspace_email: '',
      personal_email: ''
    });
    setSelectedUser(null);
    setOriginalUserGroupIds([])
    setOriginalChildIds([])
    setOriginalWorkspaceEmail('')
    setOriginalPersonalEmail('')
    setFormErrors({});
  };

  const resetGroupForm = () => {
    setGroupFormData({
      name: '',
      description: '',
      teacher_id: 0,
      curator_id: undefined,
      course_id: undefined,
      student_ids: [],
      is_active: true,
      is_special: false,
      group_type: 'group',
      program_type: 'general_english',
      max_open_lessons: 1
    });
    setGroupFormErrors({});
  };

  const resetSpecialGroupForm = () => {
    setSpecialGroupFormData({
      name: '',
      description: '',
      teacher_id: 0,
      curator_id: undefined,
      course_id: undefined,
      student_ids: [],
      is_active: true,
      is_special: true,
      group_type: 'group',
      program_type: 'general_english',
      max_open_lessons: 1
    });
    setSpecialGroupFormErrors({});
  };

  const openEditGroupModal = async (group: GroupWithDetails) => {
    setSelectedGroup(group);
    let studentIds = (group.students || []).map((student) => Number(student.id))

    if (studentIds.length === 0 && (group.student_count || 0) > 0) {
      try {
        const roster = await apiClient.getGroupStudents(group.id)
        studentIds = roster.map((student) => Number(student.id))
      } catch (error) {
        console.error('Failed to load group students for edit form', error)
      }
    }

    setOriginalEditGroupStudentIds(studentIds)
    setEditGroupFormData({
      name: group.name,
      description: group.description || '',
      teacher_id: group.teacher_id ?? 0,
      curator_id: group.curator_id || undefined,
      course_id: group.course_id ?? undefined,
      student_ids: studentIds,
      is_active: group.is_active,
      is_special: !!group.is_special,
      group_type: (group.group_type as GroupType) || 'group',
      program_type: (group.program_type as CourseType) || 'general_english',
      max_open_lessons: group.max_open_lessons != null && group.max_open_lessons >= 1 ? group.max_open_lessons : 1
    });
    setShowEditGroupModal(true);
  };

  const resetEditGroupForm = () => {
    setEditGroupFormData({
      name: '',
      description: '',
      teacher_id: 0,
      curator_id: undefined,
      course_id: undefined,
      student_ids: [],
      is_active: true,
      is_special: false,
      group_type: 'group',
      program_type: 'general_english',
      max_open_lessons: 1
    });
    setSelectedGroup(null);
    setOriginalEditGroupStudentIds([])
    setEditGroupFormErrors({});
  };

  const totalPages = Math.ceil(totalUsers / pageSize);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground dark:text-foreground flex items-center">
            {t('adminUsers.page.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('adminUsers.page.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="flex items-center gap-2 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                {t('adminUsers.page.add')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[220px]">
              <DropdownMenuItem onClick={() => setShowCreateModal(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                {isHeadCurator ? t('adminUsers.page.addCurator') : t('adminUsers.page.addUser')}
              </DropdownMenuItem>
              {!isHeadCurator && (
                <>
                  <DropdownMenuItem onClick={() => setShowBulkAddModal(true)}>
                    <Users className="mr-2 h-4 w-4" />
                    {t('adminUsers.page.bulkAddStudents')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowBulkTextModal(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    {t('adminUsers.page.importFromText')}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 @lg:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="search" className="text-sm font-medium">{t('common.search')}</Label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="search"
                  type="text"
                  placeholder={t('adminUsers.filters.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleFilterChange('search', e.target.value);
                  }}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="role" className="text-sm font-medium">{t('adminUsers.fields.role')}</Label>
              <Select
                value={roleFilter}
                onValueChange={(value) => {
                  setRoleFilter(value);
                  handleFilterChange('role', value);
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={t('adminUsers.filters.allRoles')} />
                </SelectTrigger>
                <SelectContent>
                  {isHeadCurator ? (
                    <SelectItem value="curator">{roleLabel('curator')}</SelectItem>
                  ) : (
                    <>
                      <SelectItem value="all">{t('adminUsers.filters.allRoles')}</SelectItem>
                      <SelectItem value="student">{roleLabel('student')}</SelectItem>
                      <SelectItem value="teacher">{roleLabel('teacher')}</SelectItem>
                      <SelectItem value="head_curator">{roleLabel('head_curator')}</SelectItem>
                      <SelectItem value="curator">{roleLabel('curator')}</SelectItem>
                      <SelectItem value="admin">{roleLabel('admin')}</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="group" className="text-sm font-medium">{t('adminUsers.filters.group')}</Label>
              <Select
                value={groupFilter}
                onValueChange={(value) => {
                  setGroupFilter(value);
                  handleFilterChange('group_id', value);
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={t('adminUsers.filters.allGroups')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('adminUsers.filters.allGroups')}</SelectItem>
                  {groups?.map((group) => (
                    <SelectItem key={group.id} value={group.id.toString()}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="status" className="text-sm font-medium">{t('adminUsers.filters.status')}</Label>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  handleFilterChange('is_active', value);
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={t('adminUsers.filters.allStatuses')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('adminUsers.filters.allStatuses')}</SelectItem>
                  <SelectItem value="true">{t('adminUsers.filters.active')}</SelectItem>
                  <SelectItem value="false">{t('adminUsers.filters.inactive')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="trial" className="text-sm font-medium">{t('adminUsers.filters.trial')}</Label>
              <Select
                value={trialFilter}
                onValueChange={(value) => {
                  setTrialFilter(value);
                  handleFilterChange('is_trial', value);
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={t('adminUsers.filters.allUsers')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('adminUsers.filters.allUsers')}</SelectItem>
                  <SelectItem value="true">{t('adminUsers.filters.trialOnly')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {activeFilterChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t dark:border-border">
              <span className="text-xs text-muted-foreground">{t('users.filter.label')}</span>
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  onClick={chip.clear}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-brand-subtle text-brand-subtle-foreground hover:bg-brand-subtle"
                >
                  {chip.label}
                  <X className="w-3 h-3" />
                </button>
              ))}
              <button onClick={clearAllFilters} className="text-xs text-muted-foreground hover:text-foreground underline ml-1">
                {t('users.filter.clearAll')}
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs
        value={searchParams.get('tab') || '0'}
        onValueChange={(value) => {
          const newParams = new URLSearchParams(searchParams);
          newParams.set('tab', value);
          setSearchParams(newParams);
        }}
        className="w-full"
      >
        <TabsList className={`grid w-full ${isHeadCurator ? 'grid-cols-1' : 'grid-cols-2'}`}>
          <TabsTrigger value="0">{t('adminUsers.tabs.users')}</TabsTrigger>
          {!isHeadCurator && <TabsTrigger value="1">{t('adminUsers.tabs.groups')}</TabsTrigger>}
        </TabsList>
        <TabsContent value="0">
          {/* Users Tab Content */}
          <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {roleFilter === 'student' ? 
                  t('adminUsers.list.students') : 
                  t('adminUsers.list.usersCount', { count: totalUsers })
                }
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  onClick={loadUsers}
                  variant="ghost"
                  size="sm"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          
          {isLoading ? (
            <div className="p-6 text-center">
              <Loader size="lg" animation="spin" color="hsl(var(--brand))" />
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h3 className="font-semibold text-red-800 dark:text-red-400">{t('adminUsers.list.loadErrorTitle')}</h3>
                <p className="text-red-600 dark:text-red-400">{error}</p>
                <button 
                  onClick={loadUsers}
                  className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  {t('common.retry')}
                </button>
              </div>
            </div>
          ) : (
            <>
              {!isHeadCurator && (
                <BulkActionsBar
                  count={selectedIds.size}
                  onClear={() => setSelectedIds(new Set())}
                  actions={[
                    { label: t('users.bulk.addToGroup'), icon: <UserPlus className="w-4 h-4" />, onClick: () => setShowBulkAddToGroup(true) },
                    { label: t('users.bulk.activate'), icon: <Check className="w-4 h-4" />, onClick: () => handleBulkSetActive(true) },
                    { label: t('users.bulk.deactivate'), icon: <Trash2 className="w-4 h-4" />, variant: 'destructive', onClick: () => handleBulkSetActive(false) },
                  ]}
                />
              )}
              <UsersTable
                users={users}
                groupNameById={allGroupsById}
                selectable={!isHeadCurator}
                selectedIds={selectedIds}
                onToggle={toggleSelect}
                onToggleAll={toggleSelectAll}
                onEdit={openEditModal}
                onDelete={openDeleteModal}
                offboards={offboardsInstead}
                onOffboard={offboard.open}
                onToggleAnalyticsHidden={handleToggleAnalyticsHidden}
                onProvisionPlatform={handleProvisionPlatform}
                provisioningIds={provisioningIds}
              />
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-3 border-t dark:border-border bg-muted dark:bg-secondary">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-foreground/80">
                      {t('adminUsers.list.showing', { from: ((currentPage - 1) * pageSize) + 1, to: Math.min(currentPage * pageSize, totalUsers), total: totalUsers })}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        variant="outline"
                        size="sm"
                      >
                        {t('adminUsers.list.previous')}
                      </Button>
                      <span className="px-3 py-1 text-sm">
                        {t('adminUsers.list.page', { page: currentPage, total: totalPages })}
                      </span>
                      <Button
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        variant="outline"
                        size="sm"
                      >
                        {t('adminUsers.list.next')}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
        </TabsContent>
        <TabsContent value="1">
          {/* Groups Tab Content */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  {t('adminUsers.groups.title', { count: groups.length })}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={loadGroups}
                    variant="ghost"
                    size="sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => {
                      resetGroupForm();
                      setShowCreateGroupModal(true);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    {t('adminUsers.groups.create')}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" aria-label={t('adminUsers.groups.moreActions')}>
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[220px]">
                      <DropdownMenuItem onClick={() => setShowBulkScheduleModal(true)}>
                        <Upload className="mr-2 h-4 w-4" />
                        {t('adminUsers.groups.bulkSchedule')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          resetSpecialGroupForm()
                          setShowCreateSpecialGroupModal(true)
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        {t('adminUsers.groups.createSpecial')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              {/* Group Status + program filters */}
              <div className="mt-4 flex flex-wrap items-end gap-6">
                <div>
                  <Label htmlFor="group-search" className="text-sm font-medium">{t('common.search')}</Label>
                  <Input
                    id="group-search"
                    value={groupSearch}
                    onChange={(e) => setGroupSearch(e.target.value)}
                    placeholder={t('adminUsers.groups.searchPlaceholder')}
                    className="w-52"
                  />
                </div>
                <div>
                  <Label htmlFor="group-status" className="text-sm font-medium">{t('adminUsers.groups.statusFilter')}</Label>
                  <Select
                    value={groupStatusFilter}
                    onValueChange={(value: 'all' | 'true' | 'false') => setGroupStatusFilter(value)}
                  >
                    <SelectTrigger id="group-status" className="mt-2 w-48">
                      <SelectValue placeholder={t('adminUsers.groups.statusPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('adminUsers.filters.allGroups')}</SelectItem>
                      <SelectItem value="true">{t('adminUsers.filters.active')}</SelectItem>
                      <SelectItem value="false">{t('adminUsers.filters.inactive')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="group-program-filter" className="text-sm font-medium">{t('users.groups.programFilter')}</Label>
                  <Select
                    value={groupProgramFilter}
                    onValueChange={(value: 'all' | CourseType) => setGroupProgramFilter(value)}
                  >
                    <SelectTrigger id="group-program-filter" className="mt-2 w-56">
                      <SelectValue placeholder={t('users.groups.allPrograms')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('users.groups.allPrograms')}</SelectItem>
                      <SelectItem value="sat">SAT</SelectItem>
                      <SelectItem value="ielts">IELTS</SelectItem>
                      <SelectItem value="general_english">{COURSE_TYPE_LABELS.general_english}</SelectItem>
                      <SelectItem value="nuet">NUET</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            
            <div className="overflow-x-auto">
              <table className="w-full">
<thead className="bg-muted dark:bg-secondary">
                <tr>
                    <th className="px-3 @4xl:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('adminUsers.groups.colName')}
                    </th>
                    <th className="px-3 @4xl:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('adminUsers.groups.colType')}
                    </th>
                    <th className="px-3 @4xl:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('users.groups.program')}
                    </th>
                    <th className="px-3 @4xl:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('adminUsers.groups.colTeacher')}
                    </th>
                    <th className="px-3 @4xl:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('adminUsers.groups.colCurator')}
                    </th>
                    <th className="px-3 @4xl:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('adminUsers.groups.colStudents')}
                    </th>
                    <th className="px-3 @4xl:px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('adminUsers.groups.colStatus')}
                    </th>
                    <th className="px-3 @4xl:px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t('adminUsers.groups.colActions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card dark:bg-card divide-y divide-border dark:divide-border">
                  {groups?.filter(g => !groupSearch.trim() || (g.name || '').toLowerCase().includes(groupSearch.trim().toLowerCase())).map((group) => (
                    <tr key={group.id} className="hover:bg-muted dark:hover:bg-secondary">
                      <td className="px-3 @4xl:px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-foreground dark:text-foreground">{group.name}</div>
                          {group.description && (
                            <div className="text-sm text-muted-foreground">{group.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 @4xl:px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs rounded-full bg-muted text-foreground/80">
                          {t(GROUP_TYPE_LABELS[(group.group_type as GroupType) || 'group'])}
                        </span>
                      </td>
                      <td className="px-3 @4xl:px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs rounded-full bg-amber-100 dark:bg-amber-900/35 dark:text-amber-200 text-amber-900">
                          {COURSE_TYPE_LABELS[(group.program_type as CourseType) || 'general_english']}
                        </span>
                      </td>
                      <td className="px-3 @4xl:px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs rounded-full bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400 text-purple-700">
                          {group.teacher_name || t('adminUsers.groups.noTeacher')}
                        </span>
                      </td>
                      <td className="px-3 @4xl:px-6 py-4 whitespace-nowrap">
                        {group.curator_name ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-brand-subtle text-brand-subtle-foreground">
                            {group.curator_name}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">{t('adminUsers.groups.noCurator')}</span>
                        )}
                      </td>
                      <td className="px-3 @4xl:px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-900/30 dark:text-green-400 text-green-700">
                          {t('common.students', { count: group.student_count || 0 })}
                        </span>
                      </td>
                      <td className="px-3 @4xl:px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          group.is_active ? 'bg-green-100 dark:bg-green-900/30 dark:text-green-400 text-green-700' : 'bg-muted text-foreground/80'
                        }`}>
                          {group.is_active ? t('adminUsers.groups.active') : t('adminUsers.groups.inactive')}
                        </span>
                      </td>
                      <td className="px-3 @4xl:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            onClick={() => { void openEditGroupModal(group) }}
                            variant="ghost"
                            size="sm"
                            title={t('adminUsers.groups.edit')}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => {
                              setScheduleGroupId(group.id);
                              setShowScheduleModal(true);
                            }}
                            variant="ghost"
                            size="sm"
                            title={t('adminUsers.groups.schedule')}
                          >
                            <CalendarIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => {
                              setSelectedGroup(group);
                              setShowDeleteModal(true);
                            }}
                            variant="ghost"
                            size="sm"
                            title={t('adminUsers.groups.deactivate')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create User Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={t('adminUsers.modal.createUser')}
        onSubmit={handleCreateUser}
        submitText={t('adminUsers.modal.createUserSubmit')}
        submitDisabled={!!formData.password && !!passwordPolicyError(formData.password)}
      >
        <UserForm
          formData={formData}
          setFormData={setFormData}
          groups={groups}
          courses={courses}
          students={students}
          errors={formErrors}
          isHeadCurator={isHeadCurator}
        />
        {formData.role === 'student' && (
          <label className="flex items-center gap-2 mt-2 px-1 cursor-pointer">
            <Checkbox checked={sendInviteOnCreate} onCheckedChange={(c) => setSendInviteOnCreate(c === true)} />
            <span className="text-sm text-foreground/80">{t('users.form.sendInvite')}</span>
          </label>
        )}
      </Modal>

      {/* Edit User Modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={t('adminUsers.modal.editUser')}
        onSubmit={handleUpdateUser}
        submitText={t('adminUsers.modal.updateUserSubmit')}
        submitDisabled={!!formData.password && !!passwordPolicyError(formData.password)}
      >
        <UserForm
          formData={formData}
          setFormData={setFormData}
          groups={groups}
          courses={courses}
          students={students}
          errors={formErrors}
          isHeadCurator={isHeadCurator}
          canEditPersonalEmail={isAdmin}
          isEdit
          onOffboard={selectedUser && selectedUser.is_active && offboardsInstead(selectedUser)
            ? () => { setShowEditModal(false); offboard.open(selectedUser); }
            : undefined}
        />

      </Modal>

      {offboard.dialog}

      {/* Generated Password Modal */}
      <Modal
        open={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title={t('adminUsers.password.title')}
        onSubmit={() => setShowPasswordModal(false)}
        submitText={t('adminUsers.password.done')}
      >
        <div className="space-y-4">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
            <p className="text-green-800 dark:text-green-400 text-sm">
              {t('adminUsers.password.intro')}
            </p>
          </div>
          
          <div>
            <Label className="text-sm font-medium mb-1.5 block">{t('adminUsers.password.label')}</Label>
            <div className="flex items-center gap-2">
              <div className="bg-muted dark:bg-secondary border border-border dark:border-border rounded-md p-3 flex-1 font-mono text-lg tracking-wider text-center select-all">
                {generatedPassword}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-[54px] w-[54px]"
                onClick={() => {
                  if (generatedPassword) {
                    navigator.clipboard.writeText(generatedPassword);
                    toast(t('adminUsers.password.copied'), 'success');
                  }
                }}
                title={t('adminUsers.password.copy')}
              >
                <Copy className="h-5 w-5" />
              </Button>
            </div>
          </div>
          
<p className="text-xs text-muted-foreground mt-2">
          {t('adminUsers.password.hint')}
        </p>
        </div>
      </Modal>

      {/* Create Group Modal */}
      <Modal
        open={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        title={t('adminUsers.modal.createGroup')}
        onSubmit={handleCreateGroup}
        submitText={t('adminUsers.groups.create')}
      >
        <GroupForm
          formData={groupFormData}
          setFormData={setGroupFormData}
          teachers={teachers}
          curators={curators}
          students={students}
          courses={courses}
          errors={groupFormErrors}
          purpose="standard"
        />
      </Modal>

      {/* Create Special Group Modal */}
      <Modal
        open={showCreateSpecialGroupModal}
        onClose={() => {
          setShowCreateSpecialGroupModal(false);
          resetSpecialGroupForm();
        }}
        title={t('adminUsers.groups.createSpecial')}
        onSubmit={handleCreateSpecialGroup}
        submitText={t('adminUsers.groups.createSpecial')}
      >
        <GroupForm
          formData={specialGroupFormData}
          setFormData={setSpecialGroupFormData}
          teachers={teachers}
          curators={curators}
          students={students}
          courses={courses}
          errors={specialGroupFormErrors}
          purpose="special-only"
        />
      </Modal>

      {/* Edit Group Modal */}
      <Modal
        open={showEditGroupModal}
        onClose={() => {
          setShowEditGroupModal(false);
          resetEditGroupForm();
        }}
        title={t('adminUsers.modal.editGroup')}
        onSubmit={handleUpdateGroup}
        submitText={t('adminUsers.modal.updateGroupSubmit')}
      >
        <GroupForm
          formData={editGroupFormData}
          setFormData={setEditGroupFormData}
          teachers={teachers}
          curators={curators}
          students={students}
          courses={courses}
          errors={editGroupFormErrors}
          purpose="edit"
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedUser(null);
          setSelectedGroup(null);
        }}
        title={selectedUser ? t('adminUsers.deactivate.userTitle') : t('adminUsers.deactivate.groupTitle')}
        onSubmit={selectedUser ? handleDeleteUser : handleDeleteGroup}
        submitText={t('adminUsers.deactivate.submit')}
      >
        <div>
          <p className="text-muted-foreground mb-4">
            {selectedUser ? (
              <>{withBold(t('adminUsers.deactivate.userConfirm', { name: selectedUser.name ?? '' }))}</>
            ) : (
              <>{withBold(t('adminUsers.deactivate.groupConfirm', { name: selectedGroup?.name ?? '' }))}</>
            )}
          </p>
        </div>
      </Modal>

      {/* Bulk Add Students Modal */}
      <Modal
        open={showBulkAddModal}
        onClose={() => setShowBulkAddModal(false)}
        title={t('adminUsers.bulkAdd.title')}
        onSubmit={handleBulkAddStudents}
        submitText={t('adminUsers.bulkAdd.submit')}
      >
        <BulkAddStudentsForm
          formData={bulkAddFormData}
          setFormData={setBulkAddFormData}
          groups={groups}
          students={students}
        />
      </Modal>

      {/* Bulk Text Upload Modal */}
      <Modal
        open={showBulkTextModal}
        onClose={() => {
          setShowBulkTextModal(false);
          resetBulkTextForm();
        }}
        title={t('adminUsers.bulkText.title')}
        onSubmit={handleBulkTextUpload}
        submitText={isBulkTextLoading ? t('adminUsers.bulkText.importing') : t('adminUsers.bulkText.submit')}
      >
        <BulkTextUploadForm
          formData={bulkTextFormData}
          setFormData={setBulkTextFormData}
          groups={groups}
          results={bulkTextResults}
          isLoading={isBulkTextLoading}
        />
      </Modal>
      
      {/* Schedule Generator Modal */}
      <ScheduleGenerator
          groupId={scheduleGroupId}
          open={showScheduleModal}
          onOpenChange={setShowScheduleModal}
          onSuccess={() => toast(t('adminUsers.schedule.updated'), 'success')}
      />

      <AddToGroupDialog
        open={showBulkAddToGroup}
        studentIds={[...selectedIds]}
        groups={allGroupsList}
        onClose={(changed) => {
          setShowBulkAddToGroup(false);
          if (changed) { setSelectedIds(new Set()); loadUsers(); loadAllGroupsMap(); }
        }}
      />

      {/* Bulk Schedule Upload Modal */}
      <Modal
        open={showBulkScheduleModal}
        onClose={() => setShowBulkScheduleModal(false)}
        title={t('adminUsers.bulkSchedule.title')}
        onSubmit={handleBulkScheduleUpload}
        submitText={isBulkScheduleLoading ? t('adminUsers.bulkSchedule.uploading') : t('adminUsers.bulkSchedule.submit')}
      >
        <div className="space-y-4">
          <div className="p-1">
            <Label className="text-sm font-medium">{t('adminUsers.bulkSchedule.dataLabel')}</Label>
            <p className="text-xs text-muted-foreground mt-1 mb-2">
              {t('adminUsers.bulkSchedule.format')}
            </p>
            <textarea
              value={bulkScheduleText}
              onChange={(e) => setBulkScheduleText(e.target.value)}
              placeholder={t('users.bulkSchedule.placeholder')}
              className="w-full h-64 p-3 border rounded-md text-sm font-mono resize-y focus:ring-2 focus:ring-brand focus:border-brand"
              disabled={isBulkScheduleLoading}
            />
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-muted-foreground">
                {t('adminUsers.import.linesDetected', { count: bulkScheduleText.trim().split('\n').filter(l => l.trim()).length })}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBulkScheduleText('')}
                className="h-6 text-xs"
                type="button"
                disabled={isBulkScheduleLoading}
              >
                {t('adminUsers.import.clear')}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// User Form Component
interface UserFormProps {
  formData: UserFormData;
  setFormData: (data: UserFormData) => void;
  groups: GroupWithDetails[];
  courses: Course[];
  students: User[];
  errors?: { [key: string]: string };
  isHeadCurator?: boolean;
  canEditPersonalEmail?: boolean;
  isEdit?: boolean;
  /** An active staff member is switched off through offboarding, not this checkbox (SPEC §12 Q92). */
  onOffboard?: () => void;
}

function UserForm({ formData, setFormData, groups, courses, students, errors = {}, isHeadCurator = false, canEditPersonalEmail = false, isEdit = false, onOffboard }: UserFormProps) {
  const t = useT();
  const [groupSearch, setGroupSearch] = useState('');
  const [childSearch, setChildSearch] = useState('');
  // In edit mode the password field is hidden behind an explicit "set new password"
  // action: with no field rendered, the browser/password-manager can't autofill a stray
  // credential (which was being sent as an unintended password change and failing the
  // policy). It's revealed only when the admin deliberately chooses to change it.
  const [changePassword, setChangePassword] = useState(false);
  // Checked live as the admin types; the submit button stays disabled until it passes.
  const passwordError = formData.password ? passwordPolicyError(formData.password) : null;
  const displayedGroups = React.useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    const filtered = (groups || []).filter((g) => !q || g.name.toLowerCase().includes(q));
    return [...filtered].sort((a, b) => {
      const sa = formData.group_ids.includes(a.id) ? 0 : 1;
      const sb = formData.group_ids.includes(b.id) ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return a.name.localeCompare(b.name, 'ru');
    });
  }, [groups, groupSearch, formData.group_ids]);
  const selectedGroups = (groups || []).filter((g) => formData.group_ids.includes(g.id));
  // Child (student) picker for the parent role — reuses the already-loaded `students` list.
  const displayedChildren = React.useMemo(() => {
    const q = childSearch.trim().toLowerCase();
    const filtered = (students || []).filter(
      (s) => !q || (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q)
    );
    return [...filtered].sort((a, b) => {
      const sa = formData.child_ids.includes(Number(a.id)) ? 0 : 1;
      const sb = formData.child_ids.includes(Number(b.id)) ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return (a.name || '').localeCompare(b.name || '', 'ru');
    });
  }, [students, childSearch, formData.child_ids]);
  const selectedChildren = (students || []).filter((s) => formData.child_ids.includes(Number(s.id)));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="p-1">
          <Label htmlFor="name" className="text-sm font-medium">{t('adminUsers.fields.name')}</Label>
          <Input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            className={errors.name ? 'border-red-500' : ''}
          />
          {errors.name && (
            <p className="text-red-500 text-xs mt-1 dark:text-red-400">{errors.name}</p>
          )}
        </div>
        
        <div className="p-1">
          <Label htmlFor="email" className="text-sm font-medium">{t('adminUsers.fields.email')}</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            className={errors.email ? 'border-red-500' : ''}
          />
          {errors.email && (
            <p className="text-red-500 text-xs mt-1 dark:text-red-400">{errors.email}</p>
          )}
        </div>
      </div>
      
        <div className="p-1">
          <Label htmlFor="role" className="text-sm font-medium">{t('adminUsers.fields.role')}</Label>
          <Select
            value={formData.role}
            onValueChange={(value) => {
              const newRole = value as any;
              setFormData({
                ...formData,
                role: newRole,
                // Clear groups if role is not student
                group_ids: newRole === 'student' ? formData.group_ids : [],
                course_ids: newRole === 'head_teacher' ? formData.course_ids : [],
                child_ids: newRole === 'parent' ? formData.child_ids : []
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('adminUsers.fields.rolePlaceholder')} />
            </SelectTrigger>
            <SelectContent className="z-[1100]">
              {isHeadCurator ? (
                <SelectItem value="curator">{roleLabel('curator')}</SelectItem>
              ) : (
                <>
                  <SelectItem value="student">{roleLabel('student')}</SelectItem>
                  <SelectItem value="teacher">{roleLabel('teacher')}</SelectItem>
                  <SelectItem value="head_teacher">{roleLabel('head_teacher')}</SelectItem>
                  <SelectItem value="head_curator">{roleLabel('head_curator')}</SelectItem>
                  <SelectItem value="curator">{roleLabel('curator')}</SelectItem>
                  <SelectItem value="admin">{roleLabel('admin')}</SelectItem>
                  <SelectItem value="parent">{roleLabel('parent')}</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>
        
        {/* Personal contact/recovery address: admin only, never used to sign in. */}
        {isEdit && canEditPersonalEmail && formData.role !== 'student' && (
          <div className="p-1">
            <Label htmlFor="personal_email" className="text-sm font-medium">
              {t('adminUsers.fields.personalEmail')}
            </Label>
            <Input
              id="personal_email"
              type="email"
              value={formData.personal_email || ''}
              onChange={(e) => setFormData({ ...formData, personal_email: e.target.value })}
              className={errors.personal_email ? 'border-red-500' : ''}
            />
            {errors.personal_email && (
              <p className="text-red-500 text-xs mt-1 dark:text-red-400">{errors.personal_email}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {t('adminUsers.fields.personalEmailHelp')}
            </p>
          </div>
        )}

        {/* Recordings connection — the teacher's @mastereducation.kz account. Only in edit
            mode: creating it here would run before the user row exists. */}
        {isEdit && (formData.role === 'teacher' || formData.role === 'head_teacher') && (
          <div className="p-1">
            <Label htmlFor="workspace_email" className="text-sm font-medium">
              {t('adminUsers.fields.workspaceEmail')}
            </Label>
            <Input
              id="workspace_email"
              type="email"
              value={formData.workspace_email || ''}
              onChange={(e) => setFormData({ ...formData, workspace_email: e.target.value })}
              placeholder="name@mastereducation.kz"
              className={errors.workspace_email ? 'border-red-500' : ''}
            />
            {errors.workspace_email && (
              <p className="text-red-500 text-xs mt-1 dark:text-red-400">{errors.workspace_email}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {t('adminUsers.fields.workspaceHelp')}
            </p>
          </div>
        )}

        {/* Groups field — searchable multi-select (students only) */}
        {formData.role === 'student' && (
          <div className="p-1">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{t('adminUsers.fields.groups')}</Label>
              <span className="text-xs text-muted-foreground">{t('users.form.selectedCount', { count: formData.group_ids.length })}</span>
            </div>
            {selectedGroups.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selectedGroups.map((g) => (
                  <span key={g.id} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-brand-subtle text-brand-subtle-foreground">
                    {g.name}
                    <button type="button" aria-label={t('users.form.remove', { name: g.name })} onClick={() => setFormData({ ...formData, group_ids: formData.group_ids.filter((id) => id !== g.id) })}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={groupSearch} onChange={(e) => setGroupSearch(e.target.value)} placeholder={t('users.form.searchGroup')} className="pl-9 h-9" />
            </div>
            <div className="mt-2 max-h-48 overflow-y-auto space-y-0.5 border rounded-md p-2">
              {displayedGroups.length > 0 ? (
                displayedGroups.map((group) => (
                  <label key={group.id} htmlFor={`group-${group.id}`} className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted/60">
                    <Checkbox
                      id={`group-${group.id}`}
                      checked={formData.group_ids.includes(group.id)}
                      onCheckedChange={(checked) => {
                        setFormData(checked
                          ? { ...formData, group_ids: [...formData.group_ids, group.id] }
                          : { ...formData, group_ids: formData.group_ids.filter((id) => id !== group.id) });
                      }}
                    />
                    <span className="text-sm font-normal">{group.name}</span>
                  </label>
                ))
              ) : (
                <p className="text-sm text-muted-foreground px-2 py-1.5">
                  {groups && groups.length > 0 ? t('users.form.nothingFound') : t('adminUsers.fields.noGroups')}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Courses field - checkboxes for multiple selection (head_teacher only) */}
        {formData.role === 'head_teacher' && (
          <div className="p-1">
            <Label className="text-sm font-medium">{t('adminUsers.fields.assignedCourses')}</Label>
            <div className="mt-2 max-h-40 overflow-y-auto space-y-2 border rounded-md p-3">
              {courses && courses.length > 0 ? (
                courses.map((course) => (
                  <div key={course.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`course-${course.id}`}
                      checked={formData.course_ids.includes(Number(course.id))}
                      onCheckedChange={(checked) => {
                        const courseId = Number(course.id);
                        if (checked) {
                          setFormData({
                            ...formData,
                            course_ids: [...formData.course_ids, courseId]
                          });
                        } else {
                          setFormData({
                            ...formData,
                            course_ids: formData.course_ids.filter(id => id !== courseId)
                          });
                        }
                      }}
                    />
                    <Label htmlFor={`course-${course.id}`} className="text-sm font-normal cursor-pointer">
                      {course.title}
                    </Label>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">{t('adminUsers.fields.noCourses')}</p>
              )}
            </div>
            {formData.course_ids.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {t('adminUsers.fields.coursesSelected', { count: formData.course_ids.length })}
              </p>
            )}
          </div>
        )}

        {/* Children field — searchable multi-select of students (parent only) */}
        {formData.role === 'parent' && (
          <div className="p-1">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{t('adminUsers.fields.children')}</Label>
              <span className="text-xs text-muted-foreground">{t('users.form.selectedCount', { count: formData.child_ids.length })}</span>
            </div>
            {selectedChildren.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selectedChildren.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-brand-subtle text-brand-subtle-foreground">
                    {s.name}
                    <button type="button" aria-label={t('users.form.remove', { name: s.name ?? '' })} onClick={() => setFormData({ ...formData, child_ids: formData.child_ids.filter((id) => id !== Number(s.id)) })}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={childSearch} onChange={(e) => setChildSearch(e.target.value)} placeholder={t('users.form.searchStudent')} className="pl-9 h-9" />
            </div>
            <div className="mt-2 max-h-48 overflow-y-auto space-y-0.5 border rounded-md p-2">
              {displayedChildren.length > 0 ? (
                displayedChildren.map((s) => {
                  const sid = Number(s.id);
                  return (
                    <label key={s.id} htmlFor={`child-${s.id}`} className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted/60">
                      <Checkbox
                        id={`child-${s.id}`}
                        checked={formData.child_ids.includes(sid)}
                        onCheckedChange={(checked) => {
                          setFormData(checked
                            ? { ...formData, child_ids: [...formData.child_ids, sid] }
                            : { ...formData, child_ids: formData.child_ids.filter((id) => id !== sid) });
                        }}
                      />
                      <span className="text-sm font-normal">{s.name}{s.email ? <span className="text-muted-foreground"> · {s.email}</span> : null}</span>
                    </label>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground px-2 py-1.5">
                  {students && students.length > 0 ? t('users.form.nothingFound') : t('adminUsers.fields.noStudents')}
                </p>
              )}
            </div>
          </div>
        )}

      {formData.role === 'student' && (
        <div className="p-1">
          <Label htmlFor="student_id" className="text-sm font-medium">{t('adminUsers.fields.studentId')}</Label>
          <Input
            id="student_id"
            type="text"
            value={formData.student_id || ''}
            onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
            placeholder={t('adminUsers.fields.optional')}
          />
        </div>
      )}

      <div className="p-1">
        <Label htmlFor="password" className="text-sm font-medium">{t('adminUsers.fields.password')}</Label>
        {isEdit && !changePassword ? (
          <button
            type="button"
            className="mt-1 block text-sm text-brand hover:underline"
            onClick={() => setChangePassword(true)}
          >
            {t('adminUsers.fields.setNewPassword')}
          </button>
        ) : (
          <>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              autoFocus={isEdit}
              value={formData.password || ''}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder={isEdit ? passwordHint() : t('adminUsers.fields.passwordAuto')}
            />
            {isEdit && (
              <button
                type="button"
                className="mt-1 block text-xs text-muted-foreground hover:underline"
                onClick={() => { setChangePassword(false); setFormData({ ...formData, password: '' }); }}
              >
                {t('adminUsers.fields.cancelPasswordChange')}
              </button>
            )}
          </>
        )}
        {passwordError && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{passwordError}</p>
        )}
      </div>
      
      {onOffboard ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('offboarding.userForm.hint')}</span>
          <Button type="button" variant="outline" size="sm" onClick={onOffboard}>{t('offboarding.action.offboard')}</Button>
        </div>
      ) : (
        <div className="flex items-center space-x-2">
          <Checkbox
            id="is_active"
            checked={formData.is_active}
            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked as boolean })}
          />
          <Label htmlFor="is_active" className="text-sm">
            {t('adminUsers.fields.userActive')}
          </Label>
        </div>
      )}
    </div>
  );
}

// Group Form Component
interface GroupFormProps {
  formData: GroupFormData;
  setFormData: React.Dispatch<React.SetStateAction<GroupFormData>>;
  teachers: User[];
  curators: User[];
  students: User[];
  courses: Course[]; // Добавляем список курсов
  errors?: { [key: string]: string };
  /** Dedicated special-group create flow: hides “Special group” toggle and shows short help */
  purpose?: 'standard' | 'special-only' | 'edit';
}

function GroupForm({
  formData,
  setFormData,
  teachers,
  curators,
  students,
  courses,
  errors = {},
  purpose = 'standard'
}: GroupFormProps) {
  const t = useT();
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  // Функция для генерации названия группы. Curators keep their first word; a teacher's name is
  // «Фамилия Имя Отчество», so their part comes from teacherGroupTail (first name, plus the
  // surname initial when two teachers share it).
  const generateGroupName = (personName: string, description?: string, tail?: string) => {
    const firstName = tail || personName.split(" ")[0];
    const suffix = description?.trim() || 'Group';
    return `${suffix} - ${firstName}`;
  };

  // Auto-generate group name from teacher (default) or curator (special groups)
  React.useEffect(() => {
    if (formData.is_special) {
      if (formData.curator_id) {
        const curator = curators.find((t) => Number(t.id) === formData.curator_id);
        if (curator) {
          const label = curator.name || curator.full_name || 'Curator';
          const newName = generateGroupName(label, formData.description);
          setFormData((prev: GroupFormData) => ({ ...prev, name: newName }));
        }
      }
    } else if (formData.teacher_id) {
      const selectedTeacher = teachers.find((t) => Number(t.id) === formData.teacher_id);
      if (selectedTeacher) {
        const teacherName = selectedTeacher.name || selectedTeacher.full_name;
        const tail = teacherGroupTail(teacherName, teachers.map((t) => t.name || t.full_name || ''));
        const newName = generateGroupName(teacherName, formData.description, tail);
        setFormData((prev: GroupFormData) => ({ ...prev, name: newName }));
      }
    }
  }, [formData.is_special, formData.teacher_id, formData.curator_id, formData.description, teachers, curators]);

  const resolveProgramTypeFromCourse = (courseId?: number): CourseType => {
    if (courseId == null) return 'general_english'
    const c = courses.find((x) => Number(x.id) === courseId)
    if (!c) return 'general_english'
    return getEffectiveCourseType(c)
  }

  React.useEffect(() => {
    const next = resolveProgramTypeFromCourse(formData.course_id)
    setFormData((prev) => (prev.program_type === next ? prev : { ...prev, program_type: next }))
  }, [formData.course_id, courses])

  const displayedStudents = React.useMemo(() => {
    const query = studentSearchQuery.trim().toLowerCase()
    const filtered = students.filter((student) => {
      if (!query) return true
      const studentName = (student.name || student.full_name || '').toLowerCase()
      const studentEmail = (student.email || '').toLowerCase()
      return studentName.includes(query) || studentEmail.includes(query)
    })
    return filtered.sort((a, b) => {
      const idA = Number(a.id)
      const idB = Number(b.id)
      const idxA = formData.student_ids.indexOf(idA)
      const idxB = formData.student_ids.indexOf(idB)
      const pickedA = idxA >= 0
      const pickedB = idxB >= 0
      if (pickedA && pickedB) return idxA - idxB
      if (pickedA && !pickedB) return -1
      if (!pickedA && pickedB) return 1
      return (a.name || a.full_name || '').localeCompare(b.name || b.full_name || '', 'ru')
    })
  }, [students, studentSearchQuery, formData.student_ids])

  // Course is mandatory when creating a group (both standard and special);
  // the edit form keeps it optional so an existing group's course isn't forced.
  const courseRequired = purpose !== 'edit';

  return (
    <div className="space-y-4">
      {purpose === 'special-only' ? (
        <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          {withBold(t('adminUsers.groupForm.specialHelp'))}
        </div>
      ) : null}

      {/* Сначала выбор учителя и куратора */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-1">
          <Label htmlFor="teacher" className="text-sm font-medium">
            {formData.is_special ? t('adminUsers.groupForm.teacherOptional') : t('adminUsers.groupForm.teacher')}
          </Label>
          <Select
            value={
              formData.is_special
                ? (formData.teacher_id > 0 ? formData.teacher_id.toString() : 'none')
                : (formData.teacher_id > 0 ? formData.teacher_id.toString() : '')
            }
            onValueChange={(value) =>
              setFormData({
                ...formData,
                teacher_id: value && value !== 'none' ? parseInt(value, 10) : 0
              })
            }
          >
            <SelectTrigger className={errors.teacher_id ? 'border-red-500' : ''}>
              <SelectValue placeholder={formData.is_special ? t('adminUsers.groupForm.noTeacher') : t('adminUsers.groupForm.selectTeacher')} />
            </SelectTrigger>
            <SelectContent className="z-[1100]">
              {formData.is_special && <SelectItem value="none">{t('adminUsers.groupForm.noTeacher')}</SelectItem>}
              {teachers.map((teacher) => (
                <SelectItem key={teacher.id} value={teacher.id.toString()}>
                  {teacher.name || teacher.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.teacher_id && (
            <p className="text-red-500 text-xs mt-1 dark:text-red-400">{errors.teacher_id}</p>
          )}
        </div>
        
        <div className="p-1">
          <Label htmlFor="curator" className="text-sm font-medium">
            {formData.is_special ? t('adminUsers.groupForm.curatorRequiredLabel') : t('adminUsers.groupForm.curator')}
          </Label>
          <Select
            value={formData.curator_id?.toString() || 'none'}
            onValueChange={(value) => setFormData({ ...formData, curator_id: value && value !== 'none' ? parseInt(value) : undefined })}
          >
            <SelectTrigger className={errors.curator_id ? 'border-red-500' : ''}>
              <SelectValue placeholder={t('adminUsers.groupForm.noCurator')} />
            </SelectTrigger>
            <SelectContent className="z-[1100]">
              <SelectItem value="none">{t('adminUsers.groupForm.noCurator')}</SelectItem>
              {curators.map((curator) => (
                <SelectItem key={curator.id} value={curator.id.toString()}>
                  {curator.name || curator.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.curator_id && (
            <p className="text-red-500 text-xs mt-1 dark:text-red-400">{errors.curator_id}</p>
          )}
        </div>
      </div>
      
      {/* Выбор курса */}
      <div className="p-1">
        <Label htmlFor="course" className="text-sm font-medium">
          {courseRequired ? t('adminUsers.groupForm.course') : t('adminUsers.groupForm.courseOptional')}
        </Label>
        <Select
          value={formData.course_id?.toString() || 'none'}
          onValueChange={(value) => setFormData({ ...formData, course_id: value && value !== 'none' ? parseInt(value) : undefined })}
        >
          <SelectTrigger className={errors.course_id ? 'border-red-500' : ''}>
            <SelectValue placeholder={courseRequired ? t('adminUsers.groupForm.selectCourse') : t('adminUsers.groupForm.noCourse')} />
          </SelectTrigger>
          <SelectContent className="z-[1100]">
            {!courseRequired && <SelectItem value="none">{t('adminUsers.groupForm.noCourse')}</SelectItem>}
            {courses.map((course) => (
              <SelectItem key={course.id} value={String(course.id)}>
                {formatCourseOptionLabel(course)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.course_id ? (
          <p className="text-red-500 text-xs mt-1 dark:text-red-400">{errors.course_id}</p>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">
            {t('adminUsers.groupForm.courseHelp')}
          </p>
        )}
      </div>

      {formData.is_special && formData.course_id ? (
        <div className="p-1">
          <Label htmlFor="max_open_lessons" className="text-sm font-medium">
            {t('adminUsers.groupForm.openLessons')}
          </Label>
          <Input
            id="max_open_lessons"
            type="number"
            min={1}
            className={errors.max_open_lessons ? 'border-red-500' : ''}
            value={formData.max_open_lessons}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10)
              setFormData({
                ...formData,
                max_open_lessons: Number.isFinite(n) && n >= 1 ? n : 1
              })
            }}
          />
          {errors.max_open_lessons && (
            <p className="text-red-500 text-xs mt-1 dark:text-red-400">{errors.max_open_lessons}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {t('adminUsers.groupForm.openLessonsHelp')}
          </p>
        </div>
      ) : null}
      
      {/* Затем название группы с автогенерацией */}
      <div className="p-1">
        <Label htmlFor="group_name" className="text-sm font-medium">{t('adminUsers.groupForm.name')}</Label>
        <Input
          id="group_name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          className={errors.name ? 'border-red-500' : ''}
          placeholder={
            purpose === 'special-only'
              ? t('adminUsers.groupForm.namePlaceholderSpecial')
              : t('adminUsers.groupForm.namePlaceholder')
          }
        />
        {errors.name && (
          <p className="text-red-500 text-xs mt-1 dark:text-red-400">{errors.name}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {t('adminUsers.groupForm.nameHelp')}
        </p>
      </div>
      
      {/* Описание группы */}
      <div className="p-1">
        <Label htmlFor="description" className="text-sm font-medium">{t('adminUsers.groupForm.description')}</Label>
        <Input
          id="description"
          type="text"
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder={t('adminUsers.groupForm.descriptionPlaceholder')}
        />
        <p className="text-xs text-muted-foreground mt-1">
          {t('adminUsers.groupForm.descriptionHelp')}
        </p>
      </div>

      <div className="p-1">
        <Label htmlFor="group_type" className="text-sm font-medium">{t('adminUsers.groupForm.type')}</Label>
        <Select
          value={formData.group_type}
          onValueChange={(value: GroupType) => setFormData({ ...formData, group_type: value })}
        >
          <SelectTrigger id="group_type" className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[1100]">
            <SelectItem value="group">{t(GROUP_TYPE_LABELS.group)}</SelectItem>
            <SelectItem value="individual">{t(GROUP_TYPE_LABELS.individual)}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          {t('adminUsers.groupForm.typeHelp')}
        </p>
      </div>
      
      <div className="p-1">
        <Label className="text-sm font-medium">{t('adminUsers.groupForm.students')}</Label>
        <Input
          type="text"
          value={studentSearchQuery}
          onChange={(e) => setStudentSearchQuery(e.target.value)}
          placeholder={t('adminUsers.groupForm.searchStudent')}
          className="mt-2"
        />
        <div className="mt-2 max-h-40 overflow-y-auto border rounded-md p-2 space-y-2">
          {students.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('adminUsers.fields.noStudents')}</p>
          ) : displayedStudents.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('adminUsers.fields.noStudentsFound')}</p>
          ) : (
            displayedStudents.map((student) => (
              <div key={student.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`student-${student.id}`}
                  checked={formData.student_ids.includes(Number(student.id))}
                  onCheckedChange={(checked) => {
                    const sid = Number(student.id)
                    if (checked) {
                      setFormData({
                        ...formData,
                        student_ids: [sid, ...formData.student_ids.filter((id) => id !== sid)]
                      });
                    } else {
                      setFormData({
                        ...formData,
                        student_ids: formData.student_ids.filter(id => id !== sid)
                      });
                    }
                  }}
                />
                <Label htmlFor={`student-${student.id}`} className="text-sm cursor-pointer">
                  {student.name || student.full_name} ({student.email})
                </Label>
              </div>
            ))
          )}
        </div>
        {formData.student_ids.length > 0 && (
          <p className="text-sm text-muted-foreground mt-1">
            {t('adminUsers.fields.studentsSelected', { count: formData.student_ids.length })}
          </p>
        )}
      </div>
      
      <div className="flex items-center space-x-2">
        <Checkbox
          id="group_is_active"
          checked={formData.is_active}
          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked as boolean })}
        />
        <Label htmlFor="group_is_active" className="text-sm">
          {t('adminUsers.groupForm.active')}
        </Label>
      </div>

    </div>
  );
}

// Bulk Add Students Form Component
interface BulkAddStudentsFormProps {
  formData: { groupId: number | null; studentIds: number[] };
  setFormData: (data: { groupId: number | null; studentIds: number[] }) => void;
  groups: GroupWithDetails[];
  students: User[];
  errors?: { [key: string]: string };
}

function BulkAddStudentsForm({ formData, setFormData, groups, students, errors = {} }: BulkAddStudentsFormProps) {
  const t = useT();
  const [searchTerm, setSearchTerm] = useState("");
  
  const filteredStudents = React.useMemo(
    () =>
      students.filter(
        (student) =>
          (student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            student.email?.toLowerCase().includes(searchTerm.toLowerCase())) &&
          student.role === 'student' &&
          student.is_active
      ),
    [students, searchTerm]
  )

  const displayedBulkStudents = React.useMemo(() => {
    return [...filteredStudents].sort((a, b) => {
      const idA = Number(a.id)
      const idB = Number(b.id)
      const idxA = formData.studentIds.indexOf(idA)
      const idxB = formData.studentIds.indexOf(idB)
      const pickedA = idxA >= 0
      const pickedB = idxB >= 0
      if (pickedA && pickedB) return idxA - idxB
      if (pickedA && !pickedB) return -1
      if (!pickedA && pickedB) return 1
      return (a.name || a.full_name || '').localeCompare(b.name || b.full_name || '', 'ru')
    })
  }, [filteredStudents, formData.studentIds])

  // Toggle student selection (новые выбранные — в начале списка)
  const toggleStudent = (studentId: number) => {
    if (formData.studentIds.includes(studentId)) {
      setFormData({
        ...formData,
        studentIds: formData.studentIds.filter(id => id !== studentId)
      });
    } else {
      setFormData({
        ...formData,
        studentIds: [studentId, ...formData.studentIds.filter((id) => id !== studentId)]
      });
    }
  };

  // Select all filtered students
  const selectAllFiltered = () => {
    const toAdd = filteredStudents
      .map((s) => Number(s.id))
      .filter((id) => !formData.studentIds.includes(id))
    setFormData({
      ...formData,
      studentIds: [...toAdd, ...formData.studentIds]
    });
  };

  // Deselect all filtered students
  const deselectAllFiltered = () => {
    const filteredIds = filteredStudents.map(s => Number(s.id));
    setFormData({
      ...formData,
      studentIds: formData.studentIds.filter(id => !filteredIds.includes(id))
    });
  };

  return (
    <div className="space-y-4">
      <div className="p-1">
        <Label htmlFor="group" className="text-sm font-medium">{t('adminUsers.bulkAdd.group')}</Label>
        <Select
          value={formData.groupId?.toString() || ''}
          onValueChange={(value) => setFormData({ ...formData, groupId: parseInt(value) })}
        >
          <SelectTrigger className={errors.groupId ? 'border-red-500' : ''}>
            <SelectValue placeholder={t('adminUsers.bulkAdd.groupPlaceholder')} />
          </SelectTrigger>
          <SelectContent className="z-[1100]">
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id.toString()}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.groupId && (
          <p className="text-red-500 text-xs mt-1 dark:text-red-400">{errors.groupId}</p>
        )}
      </div>

      <div className="p-1">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium">{t('adminUsers.bulkAdd.students')}</Label>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={selectAllFiltered}
              className="h-6 text-xs"
              type="button"
            >
              {t('adminUsers.bulkAdd.selectAll')}
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={deselectAllFiltered}
              className="h-6 text-xs"
              type="button"
            >
              {t('adminUsers.bulkAdd.deselectAll')}
            </Button>
          </div>
        </div>
        
        <Input
          placeholder={t('adminUsers.bulkAdd.search')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mb-2"
        />

        <div className="mt-2 max-h-60 overflow-y-auto border rounded-md p-2 space-y-2">
          {displayedBulkStudents.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">{t('adminUsers.fields.noStudentsFound')}</p>
          ) : (
            displayedBulkStudents.map((student) => (
              <div key={student.id} className="flex items-center space-x-2 hover:bg-muted dark:hover:bg-secondary p-1 rounded">
                <Checkbox
                  id={`bulk-student-${student.id}`}
                  checked={formData.studentIds.includes(Number(student.id))}
                  onCheckedChange={() => toggleStudent(Number(student.id))}
                />
                <Label htmlFor={`bulk-student-${student.id}`} className="text-sm cursor-pointer flex-1">
                  <div className="font-medium">{student.name || student.full_name}</div>
                  <div className="text-xs text-muted-foreground">{student.email}</div>
                </Label>
              </div>
            ))
          )}
        </div>
        
        <div className="flex justify-between items-center mt-2">
          <p className="text-sm text-muted-foreground">
            {t('adminUsers.fields.studentsSelected', { count: formData.studentIds.length })}
          </p>
          {errors.studentIds && (
            <p className="text-red-500 text-xs dark:text-red-400">{errors.studentIds}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Bulk Text Upload Form Component
interface BulkTextUploadFormProps {
  formData: { text: string; groupIds: number[]; sendInvites: boolean };
  setFormData: (data: { text: string; groupIds: number[]; sendInvites: boolean }) => void;
  groups: GroupWithDetails[];
  results: {
    created: Array<{ user: User; generated_password?: string }>;
    failed: Array<{ email: string; error: string }>;
  } | null;
  isLoading: boolean;
}

function BulkTextUploadForm({ formData, setFormData, groups, results, isLoading }: BulkTextUploadFormProps) {
  const t = useT();
  const exampleText = t('users.bulkText.example');

  return (
    <div className="space-y-4">
      <div className="p-1">
        <Label className="text-sm font-medium">{t('adminUsers.bulkText.dataLabel')}</Label>
        <p className="text-xs text-muted-foreground mt-1 mb-2">
          {t('adminUsers.bulkText.format')}
        </p>
        <textarea
          value={formData.text}
          onChange={(e) => setFormData({ ...formData, text: e.target.value })}
          placeholder={exampleText}
          className="w-full h-48 p-3 border rounded-md text-sm font-mono resize-y focus:ring-2 focus:ring-brand focus:border-brand"
          disabled={isLoading}
        />
        <div className="flex justify-between items-center mt-1">
          <p className="text-xs text-muted-foreground">
            {t('adminUsers.import.linesDetected', { count: formData.text.trim().split('\n').filter(l => l.trim()).length })}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFormData({ ...formData, text: '' })}
            className="h-6 text-xs"
            type="button"
            disabled={isLoading}
          >
            {t('adminUsers.import.clear')}
          </Button>
        </div>
      </div>

      <label className="flex items-center gap-2 px-1 cursor-pointer">
        <Checkbox
          checked={formData.sendInvites}
          onCheckedChange={(c) => setFormData({ ...formData, sendInvites: c === true })}
          disabled={isLoading}
        />
        <span className="text-sm text-foreground/80">{t('users.bulkText.sendInvites')}</span>
      </label>

      <div className="p-1">
        <Label className="text-sm font-medium">{t('adminUsers.bulkText.groups')}</Label>
        <div className="mt-2 max-h-32 overflow-y-auto space-y-2 border rounded-md p-3">
          {groups && groups.length > 0 ? (
            groups.map((group) => (
              <div key={group.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`bulk-text-group-${group.id}`}
                  checked={formData.groupIds.includes(group.id)}
                  disabled={isLoading}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setFormData({
                        ...formData,
                        groupIds: [...formData.groupIds, group.id]
                      });
                    } else {
                      setFormData({
                        ...formData,
                        groupIds: formData.groupIds.filter(id => id !== group.id)
                      });
                    }
                  }}
                />
                <Label htmlFor={`bulk-text-group-${group.id}`} className="text-sm font-normal cursor-pointer">
                  {group.name}
                </Label>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">{t('adminUsers.fields.noGroups')}</p>
          )}
        </div>
        {formData.groupIds.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {t('adminUsers.fields.groupsSelected', { count: formData.groupIds.length })}
          </p>
        )}
      </div>

      {/* Results Section */}
      {results && (
        <div className="space-y-3 border-t pt-4">
          <h4 className="font-medium text-sm">{t('adminUsers.bulkText.results')}</h4>
          
          {results.created.length > 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3">
              <div className="flex justify-between items-center mb-2">
                <h5 className="flex items-center gap-1.5 text-green-800 dark:text-green-400 font-medium text-sm">
                  <Check className="h-4 w-4" aria-hidden="true" />
                  {t('adminUsers.bulkText.createdCount', { count: results.created.length })}
                </h5>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  type="button"
                  onClick={() => {
                    const text = results.created
                      .map(item => `${item.user.name}\t${item.user.email}\t${item.generated_password || ''}`)
                      .join('\n');
                    navigator.clipboard.writeText(text);
                    alert(t('users.bulkText.copiedAll'));
                  }}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  {t('users.bulkText.copyAll')}
                </Button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {results.created.map((item, idx) => (
                  <div key={idx} className="text-xs text-green-700 dark:text-green-400 flex justify-between items-center bg-card p-2 rounded">
                    <span>{item.user.name} ({item.user.email})</span>
                    {item.generated_password && (
                      <code className="bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded text-green-800 dark:text-green-400 cursor-pointer hover:bg-green-200 dark:hover:bg-green-800/50"
                        onClick={() => {
                          navigator.clipboard.writeText(item.generated_password!);
                        }}
                        title={t('users.bulkText.clickToCopy')}
                      >
                        {item.generated_password}
                      </code>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.failed.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <h5 className="flex items-center gap-1.5 text-red-800 dark:text-red-400 font-medium text-sm mb-2">
                <X className="h-4 w-4" aria-hidden="true" />
                {t('adminUsers.bulkText.failedCount', { count: results.failed.length })}
              </h5>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {results.failed.map((item, idx) => (
                  <div key={idx} className="text-xs text-red-700 dark:text-red-400 bg-card p-2 rounded">
                    <span className="font-medium">{item.email}:</span> {item.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
