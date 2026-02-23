import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../services/api';
import { toast } from '../components/Toast';
import type { User, CreateUserRequest, UpdateUserRequest, Group, Course } from '../types';
import { 
  Users, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  UserPlus,
  RefreshCw,
  Upload,
  GraduationCap,
  ChevronDown,
  ChevronRight,
  Copy,
  Calendar as CalendarIcon
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
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';

interface UserFormData {
  name: string;
  email: string;
  role: 'student' | 'teacher' | 'curator' | 'admin' | 'head_curator' | 'head_teacher';
  student_id?: string;
  password?: string;
  is_active: boolean;
  group_ids: number[]; // Multiple groups for students
  course_ids: number[]; // Multiple courses for head teachers
}

interface GroupFormData {
  name: string;
  description?: string;
  teacher_id: number;
  curator_id?: number;
  course_id?: number; // Курс, к которому привязана группа
  student_ids: number[];
  is_active: boolean;
}

interface GroupWithDetails extends Group {
  teacher_name?: string;
  curator_name?: string;
  students?: User[];
}

interface TeacherGroup {
  teacher_name: string;
  teacher_id?: number;
  students: User[];
  total_students: number;
  is_expanded?: boolean;
}

export default function UserManagement() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<GroupWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  
  // Filters
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') || 'student');
  const [groupFilter, setGroupFilter] = useState(searchParams.get('group_id') || 'all');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('is_active') || 'all');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [groupStatusFilter, setGroupStatusFilter] = useState<'all' | 'true' | 'false'>('true'); // Default to active groups
  
  // Teacher groups for student grouping
  const [teacherGroups, setTeacherGroups] = useState<TeacherGroup[]>([]);
  
  // Teachers and curators for group creation
  const [teachers, setTeachers] = useState<User[]>([]);
  const [curators, setCurators] = useState<User[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
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
  const [bulkTextFormData, setBulkTextFormData] = useState<{ text: string; groupIds: number[] }>({
    text: '',
    groupIds: []
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
      toast('Please enter some data', 'error');
      return;
    }

    setIsBulkScheduleLoading(true);
    try {
      const result = await apiClient.bulkScheduleUpload(bulkScheduleText);
      toast(`Created ${result.created_groups.length} groups/schedules`, 'success');
      if (result.failed_lines.length > 0) {
        console.error('Bulk upload failed lines:', result.failed_lines);
        // Show failed lines in a toast or modal
        const failedMessages = result.failed_lines.map((f: any) => `Line ${f.line_num}: ${f.error}`).join('\n');
        toast(`Created ${result.created_groups.length} groups. Failed lines:\n${failedMessages}`, 'error');
      }
      setShowBulkScheduleModal(false);
      setBulkScheduleText('');
      loadGroups();
    } catch (e: any) {
      toast(e.message || 'Failed to bulk upload schedules', 'error');
    } finally {
      setIsBulkScheduleLoading(false);
    }
  };

  const handleBulkAddStudents = async () => {
    if (!bulkAddFormData.groupId) {
      toast('Please select a group', 'error');
      return;
    }
    if (bulkAddFormData.studentIds.length === 0) {
      toast('Please select at least one student', 'error');
      return;
    }

    try {
      await apiClient.bulkAddStudentsToGroup(bulkAddFormData.groupId, bulkAddFormData.studentIds);
      toast('Students added successfully', 'success');
      setShowBulkAddModal(false);
      setBulkAddFormData({ groupId: null, studentIds: [] });
      loadGroups(); // Refresh groups to show updated counts
    } catch (error) {
      console.error('Failed to bulk add students:', error);
      toast('Failed to add students to group', 'error');
    }
  };

  const handleBulkTextUpload = async () => {
    if (!bulkTextFormData.text.trim()) {
      toast('Please paste student data', 'error');
      return;
    }

    setIsBulkTextLoading(true);
    setBulkTextResults(null);

    try {
      const result = await apiClient.bulkCreateUsersFromText(
        bulkTextFormData.text,
        bulkTextFormData.groupIds.length > 0 ? bulkTextFormData.groupIds : undefined,
        'student'
      );
      
      setBulkTextResults({
        created: result.created_users,
        failed: result.failed_users
      });

      if (result.created_users.length > 0) {
        toast(`Successfully created ${result.created_users.length} students`, 'success');
        loadUsers();
        loadGroups();
      }
      
      if (result.failed_users.length > 0 && result.created_users.length === 0) {
        toast('Failed to create students. Check the results below.', 'error');
      }
    } catch (error: any) {
      console.error('Failed to bulk create students:', error);
      toast(error.message || 'Failed to create students', 'error');
    } finally {
      setIsBulkTextLoading(false);
    }
  };

  const resetBulkTextForm = () => {
    setBulkTextFormData({ text: '', groupIds: [] });
    setBulkTextResults(null);
  };
  
  // Form data
  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    email: '',
    role: 'student',
    student_id: '',
    password: '',
    is_active: true,
    group_ids: [],
    course_ids: []
  });

  const [groupFormData, setGroupFormData] = useState<GroupFormData>({
    name: '',
    description: '',
    teacher_id: 0,
    curator_id: undefined,
    student_ids: [],
    is_active: true
  });

  const [editGroupFormData, setEditGroupFormData] = useState<GroupFormData>({
    name: '',
    description: '',
    teacher_id: 0,
    curator_id: undefined,
    student_ids: [],
    is_active: true
  });

  // Form validation errors
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [groupFormErrors, setGroupFormErrors] = useState<{ [key: string]: string }>({});
  const [editGroupFormErrors, setEditGroupFormErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    loadUsers();
    loadGroups();
    loadTeachersAndCurators();
    loadCourses();
  }, [currentPage, roleFilter, groupFilter, statusFilter, searchQuery]);

  // Reload groups when group status filter changes
  useEffect(() => {
    loadGroups();
  }, [groupStatusFilter]);

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
        search: searchQuery || undefined
      };
      
      const response = await apiClient.getUsers(params);
      
      if (response) {
        const usersData = Array.isArray(response) ? response : (response.users || []);
        const sortedUsers = [...usersData].sort((a: User, b: User) => 
          (a.name || a.full_name || '').localeCompare(b.name || b.full_name || '', 'ru')
        );
        setUsers(sortedUsers);
        setTotalUsers(response.total || usersData.length);
      } else {
        // Неожиданный формат
        console.log('Unexpected response format:', response);
        setUsers([]);
        setTotalUsers(0);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
      setError('Failed to load users');
      setUsers([]);
      setTotalUsers(0);
      toast('Failed to load users', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      const groupsData = await apiClient.getGroups();
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

  const loadTeachersAndCurators = async () => {
    try {
      const response = await apiClient.getUsers({ limit: 1000 });
      const allUsers = Array.isArray(response) ? response : response.users || [];
      const teachersList = allUsers.filter((user: User) => user.role === 'teacher' && user.is_active);
      const curatorsList = allUsers.filter((user: User) => user.role === 'curator' && user.is_active);
      const studentsList = allUsers.filter((user: User) => user.role === 'student' && user.is_active);
      
      setTeachers(teachersList);
      setCurators(curatorsList);
      setStudents(studentsList);
    } catch (error) {
      console.error('Failed to load teachers and curators:', error);
      setTeachers([]);
      setCurators([]);
      setStudents([]);
    }
  };

  // Group students by teacher when role filter is student and users are loaded
  useEffect(() => {
    if (users.length > 0 && roleFilter === 'student') {
      console.log('Grouping students after users loaded...');
      groupStudentsByTeacher();
    } else if (roleFilter !== 'student') {
      console.log('Clearing teacher groups - not student filter');
      setTeacherGroups([]);
    }
  }, [users, roleFilter]);

  // Function to group students by teacher
  const groupStudentsByTeacher = () => {
    const students = users.filter(user => user.role === 'student');
    console.log('Students for grouping:', students);
    console.log('All users:', users);
    const groupsMap = new Map<string, TeacherGroup>();
    
    students.forEach(student => {
      const teacherName = student.teacher_name || 'No Teacher Assigned';
      
      if (!groupsMap.has(teacherName)) {
        groupsMap.set(teacherName, {
          teacher_name: teacherName,
          teacher_id: undefined,
          students: [],
          total_students: 0,
          is_expanded: false
        });
      }
      
      const group = groupsMap.get(teacherName)!;
      group.students.push(student);
      group.total_students = group.students.length;
    });
    
    const teacherGroupsArray = Array.from(groupsMap.values()).sort((a, b) => 
      a.teacher_name.localeCompare(b.teacher_name, 'ru')
    );
    
    // Sort students within each teacher group
    teacherGroupsArray.forEach(tg => {
      tg.students.sort((a, b) => 
        (a.name || a.full_name || '').localeCompare(b.name || b.full_name || '', 'ru')
      );
    });

    console.log('Teacher groups:', teacherGroupsArray);
    setTeacherGroups(teacherGroupsArray);
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

  const validateForm = (): { [key: string]: string } => {
    const errors: { [key: string]: string } = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else {
      // Простая валидация email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        errors.email = 'Please enter a valid email address';
      }
    }
    
    return errors;
  };

  const validateGroupForm = (): { [key: string]: string } => {
    const errors: { [key: string]: string } = {};
    
    if (!groupFormData.name.trim()) {
      errors.name = 'Group name is required';
    }
    if (!groupFormData.teacher_id) {
      errors.teacher_id = 'Teacher is required';
    }
    
    return errors;
  };

  const validateEditGroupForm = (): { [key: string]: string } => {
    const errors: { [key: string]: string } = {};
    
    if (!editGroupFormData.name.trim()) {
      errors.name = 'Group name is required';
    }
    if (!editGroupFormData.teacher_id) {
      errors.teacher_id = 'Teacher is required';
    }
    
    return errors;
  };

  const handleCreateUser = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast('Please fix the form errors', 'error');
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
        course_ids: formData.role === 'head_teacher' && formData.course_ids.length > 0 ? formData.course_ids : undefined
      };
      
      const newUser = await apiClient.createUser(userData);
      toast('User created successfully', 'success');
      
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
      toast('Failed to create user', 'error');
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast('Please fix the form errors', 'error');
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
        // Send group_ids for students - the backend will handle the group updates
        group_ids: formData.role === 'student' ? formData.group_ids : undefined,
        course_ids: formData.role === 'head_teacher' ? formData.course_ids : undefined
      };
      
      await apiClient.updateUser(Number(selectedUser.id), userData);
      toast('User updated successfully', 'success');
      
      setShowEditModal(false);
      resetForm();
      loadUsers();
    } catch (error) {
      console.error('Failed to update user:', error);
      toast('Failed to update user', 'error');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    try {
      await apiClient.deactivateUser(Number(selectedUser.id));
      toast('User deactivated successfully', 'success');
      setShowDeleteModal(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error: any) {
      console.error('Failed to deactivate user:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to deactivate user';
      toast(errorMessage, 'error');
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    
    try {
      // Instead of deleting, deactivate the group
      await apiClient.updateGroup(selectedGroup.id, { is_active: false });
      toast('Group deactivated successfully', 'success');
      setShowDeleteModal(false);
      setSelectedGroup(null);
      loadGroups();
      loadUsers(); // Reload users to update group information
    } catch (error) {
      console.error('Failed to deactivate group:', error);
      toast('Failed to deactivate group', 'error');
    }
  };

  const handleCreateGroup = async () => {
    const errors = validateGroupForm();
    if (Object.keys(errors).length > 0) {
      setGroupFormErrors(errors);
      toast('Please fix the form errors', 'error');
      return;
    }
    setGroupFormErrors({});

    try {
      const groupData = {
        name: groupFormData.name.trim(),
        description: groupFormData.description?.trim() || undefined,
        teacher_id: groupFormData.teacher_id,
        curator_id: groupFormData.curator_id || undefined,
        course_id: groupFormData.course_id || undefined,
        is_active: groupFormData.is_active
      };
      
      const newGroup = await apiClient.createGroup(groupData);
      toast('Group created successfully', 'success');
      
      // Add students to the group if any are selected
      if (groupFormData.student_ids.length > 0) {
        try {
          await apiClient.bulkAddStudentsToGroup(newGroup.id, groupFormData.student_ids);
          toast(`Group created and ${groupFormData.student_ids.length} students added`, 'success');
        } catch (error) {
          console.error('Failed to add students to group:', error);
          toast('Group created but failed to add students', 'error');
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
      toast('Failed to create group', 'error');
    }
  };

  const handleUpdateGroup = async () => {
    if (!selectedGroup) return;
    
    const errors = validateEditGroupForm();
    if (Object.keys(errors).length > 0) {
      setEditGroupFormErrors(errors);
      toast('Please fix the form errors', 'error');
      return;
    }
    setEditGroupFormErrors({});

    try {
      const groupData = {
        name: editGroupFormData.name.trim(),
        description: editGroupFormData.description?.trim() || undefined,
        teacher_id: editGroupFormData.teacher_id,
        curator_id: editGroupFormData.curator_id || undefined,
        course_id: editGroupFormData.course_id || undefined,
        is_active: editGroupFormData.is_active
      };
      
      await apiClient.updateGroup(selectedGroup.id, groupData);
      toast('Group updated successfully', 'success');
      
      setShowEditGroupModal(false);
      resetEditGroupForm();
      loadGroups();
      loadUsers(); // Reload users to update group information
    } catch (error) {
      console.error('Failed to update group:', error);
      toast('Failed to update group', 'error');
    }
  };


  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({
      name: user.name || user.full_name || '',
      email: user.email,
      role: user.role,
      student_id: user.student_id || '',
      password: '',
      is_active: user.is_active ?? true,
      group_ids: user.group_ids || [], // Use group_ids from the user (populated by backend)
      course_ids: user.course_ids || []
    });
    setShowEditModal(true);
  };

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
      course_ids: []
    });
    setSelectedUser(null);
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
      is_active: true
    });
    setGroupFormErrors({});
  };

  const openEditGroupModal = (group: GroupWithDetails) => {
    setSelectedGroup(group);
    setEditGroupFormData({
      name: group.name,
      description: group.description || '',
      teacher_id: group.teacher_id,
      curator_id: group.curator_id || undefined,
      student_ids: group.students?.map(s => Number(s.id)) || [],
      is_active: group.is_active
    });
    setShowEditGroupModal(true);
  };

  const resetEditGroupForm = () => {
    setEditGroupFormData({
      name: '',
      description: '',
      teacher_id: 0,
      curator_id: undefined,
      student_ids: [],
      is_active: true
    });
    setSelectedGroup(null);
    setEditGroupFormErrors({});
  };

  const totalPages = Math.ceil(totalUsers / pageSize);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-foreground flex items-center">
            User Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage system users and permissions</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Button
            onClick={() => setShowCreateGroupModal(true)}
            variant="outline"
            className="flex items-center gap-2 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            Create Group
          </Button>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 w-full sm:w-auto"
          >
            <UserPlus className="w-4 h-4" />
            Add User
          </Button>
          <Button
            onClick={() => setShowBulkAddModal(true)}
            variant="secondary"
            className="flex items-center gap-2 w-full sm:w-auto"
          >
            <Users className="w-4 h-4" />
            Bulk Add Students
          </Button>
          <Button
            onClick={() => setShowBulkTextModal(true)}
            variant="outline"
            className="flex items-center gap-2 w-full sm:w-auto"
          >
            <Upload className="w-4 h-4" />
            Import from Text
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search" className="text-sm font-medium">Search</Label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="search"
                  type="text"
                  placeholder="Search users"
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
              <Label htmlFor="role" className="text-sm font-medium">Role</Label>
              <Select
                value={roleFilter}
                onValueChange={(value) => {
                  setRoleFilter(value);
                  handleFilterChange('role', value);
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="head_curator">Head Curator</SelectItem>
                  <SelectItem value="curator">Curator</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="group" className="text-sm font-medium">Group</Label>
              <Select
                value={groupFilter}
                onValueChange={(value) => {
                  setGroupFilter(value);
                  handleFilterChange('group_id', value);
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="All Groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Groups</SelectItem>
                  {groups?.map((group) => (
                    <SelectItem key={group.id} value={group.id.toString()}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="status" className="text-sm font-medium">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  handleFilterChange('is_active', value);
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
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
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="0">Users</TabsTrigger>
          <TabsTrigger value="1">Groups</TabsTrigger>
        </TabsList>
        <TabsContent value="0">
          {/* Users Tab Content */}
          <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {roleFilter === 'student' ? 
                  `Students (${totalUsers})` : 
                  `Users (${totalUsers})`
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
              <Loader size="lg" animation="spin" color="#2563eb" />
            </div>
          ) : error ? (
            <div className="p-6 text-center">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h3 className="font-semibold text-red-800 dark:text-red-400">Error loading users</h3>
                <p className="text-red-600 dark:text-red-400">{error}</p>
                <button 
                  onClick={loadUsers}
                  className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-secondary">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Group
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-card divide-y divide-gray-200 dark:divide-border">
                    {roleFilter === 'student' && teacherGroups.length > 0 ? (
                      // Show grouped students by teacher
                      teacherGroups.map((teacherGroup) => (
                        <React.Fragment key={teacherGroup.teacher_name}>
                          {/* Teacher group header */}
                          <tr className="hover:bg-gray-50 dark:hover:bg-secondary">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setTeacherGroups(prev => prev.map(group => 
                                      group.teacher_name === teacherGroup.teacher_name 
                                        ? { ...group, is_expanded: !group.is_expanded }
                                        : group
                                    ));
                                  }}
                                  className="p-0 h-6 w-6"
                                >
                                  {teacherGroup.is_expanded ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </Button>
                                <div>
                                  <div className="text-sm font-medium text-gray-900 dark:text-foreground flex items-center gap-2">
                                    {teacherGroup.teacher_name}
                                    <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-full">
                                      {teacherGroup.total_students} students
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 text-xs rounded-full bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400 text-purple-700">
                                Teacher Group
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm text-gray-500 dark:text-gray-400">-</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-900/30 dark:text-green-400 text-green-700">
                                Active
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Expand/Collapse"
                                  onClick={() => {
                                    setTeacherGroups(prev => prev.map(group => 
                                      group.teacher_name === teacherGroup.teacher_name 
                                        ? { ...group, is_expanded: !group.is_expanded }
                                        : group
                                    ));
                                  }}
                                >
                                  {teacherGroup.is_expanded ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                            </td>
                          </tr>
                          
                          {/* Student rows when expanded */}
                          {teacherGroup.is_expanded && teacherGroup.students.map((student) => (
                            <tr key={student.id || student.email} className="hover:bg-gray-50 dark:hover:bg-secondary bg-gray-25">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="ml-8">
                                  <div className="text-sm font-medium text-gray-900 dark:text-foreground">{student.name || student.full_name}</div>
                                  <div className="text-sm text-gray-500 dark:text-gray-400">{student.email}</div>
                                  {student.student_id && (
                                    <div className="text-xs text-gray-400">ID: {student.student_id}</div>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-900/30 dark:text-green-400 text-green-700">
                                  student
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {student.teacher_name || student.curator_name ? (
                                  <div className="text-sm">
                                    {student.teacher_name && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400">👨‍🏫 {student.teacher_name}</div>
                                    )}
                                    {student.curator_name && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400">👨‍💼 {student.curator_name}</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-sm text-gray-500 dark:text-gray-400">No group</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  student.is_active ? 'bg-green-100 dark:bg-green-900/30 dark:text-green-400 text-green-700' : 'bg-gray-100 dark:bg-gray-800 dark:text-gray-400 text-gray-700'
                                }`}>
                                  {student.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    onClick={() => openEditModal(student)}
                                    variant="ghost"
                                    size="sm"
                                    title="Edit User"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    onClick={() => openDeleteModal(student)}
                                    variant="ghost"
                                    size="sm"
                                    title="Deactivate User"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))
                    ) : (
                      // Show regular user list for non-student roles
                      users?.map((user) => (
                        <tr key={user.id || user.email} className="hover:bg-gray-50 dark:hover:bg-secondary">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-foreground">{user.name || user.full_name}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                              {user.student_id && (
                                <div className="text-xs text-gray-400">ID: {user.student_id}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              user.role === 'admin' ? 'bg-red-100 dark:bg-red-900/30 dark:text-red-400 text-red-700' :
                              user.role === 'teacher' ? 'bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400 text-purple-700' :
                              user.role === 'head_curator' ? 'bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 text-indigo-700' :
                              user.role === 'curator' ? 'bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 text-blue-700' :
                              'bg-green-100 dark:bg-green-900/30 dark:text-green-400 text-green-700'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {user.teacher_name || user.curator_name ? (
                              <div className="text-sm">
                                {user.teacher_name && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">👨‍🏫 {user.teacher_name}</div>
                                )}
                                {user.curator_name && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">👨‍💼 {user.curator_name}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-500 dark:text-gray-400">No group</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              user.is_active ? 'bg-green-100 dark:bg-green-900/30 dark:text-green-400 text-green-700' : 'bg-gray-100 dark:bg-gray-800 dark:text-gray-400 text-gray-700'
                            }`}>
                              {user.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                onClick={() => openEditModal(user)}
                                variant="ghost"
                                size="sm"
                                title="Edit User"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                onClick={() => openDeleteModal(user)}
                                variant="ghost"
                                size="sm"
                                title="Deactivate User"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-3 border-t dark:border-border bg-gray-50 dark:bg-secondary">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-700 dark:text-gray-400">
                      {roleFilter === 'student' ? 
                        `Showing ${teacherGroups.length} teacher groups with ${totalUsers} students` :
                        `Showing ${((currentPage - 1) * pageSize) + 1} to ${Math.min(currentPage * pageSize, totalUsers)} of ${totalUsers} results`
                      }
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        variant="outline"
                        size="sm"
                      >
                        Previous
                      </Button>
                      <span className="px-3 py-1 text-sm">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        variant="outline"
                        size="sm"
                      >
                        Next
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
                  Groups Management ({groups.length})
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
                    onClick={() => setShowBulkScheduleModal(true)}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Bulk Schedule
                  </Button>
                  <Button
                    onClick={() => setShowCreateGroupModal(true)}
                    className="flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create Group
                  </Button>
                </div>
              </div>
              {/* Group Status Filter */}
              <div className="mt-4">
                <Label htmlFor="group-status" className="text-sm font-medium">Group Status</Label>
                <Select
                  value={groupStatusFilter}
                  onValueChange={(value: 'all' | 'true' | 'false') => setGroupStatusFilter(value)}
                >
                  <SelectTrigger className="mt-2 w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Groups</SelectItem>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            
            <div className="overflow-x-auto">
              <table className="w-full">
<thead className="bg-gray-50 dark:bg-secondary">
                <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Group Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Teacher
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Curator
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Students
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-card divide-y divide-gray-200 dark:divide-border">
                  {groups?.map((group) => (
                    <tr key={group.id} className="hover:bg-gray-50 dark:hover:bg-secondary">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-foreground">{group.name}</div>
                          {group.description && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">{group.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs rounded-full bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400 text-purple-700">
                          {group.teacher_name || 'No Teacher'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {group.curator_name ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 text-blue-700">
                            {group.curator_name}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500 dark:text-gray-400">No Curator</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-900/30 dark:text-green-400 text-green-700">
                          {group.student_count || 0} students
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          group.is_active ? 'bg-green-100 dark:bg-green-900/30 dark:text-green-400 text-green-700' : 'bg-gray-100 dark:bg-gray-800 dark:text-gray-400 text-gray-700'
                        }`}>
                          {group.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            onClick={() => openEditGroupModal(group)}
                            variant="ghost"
                            size="sm"
                            title="Edit Group"
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
                            title="Manage Schedule"
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
                            title="Deactivate Group"
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
        title="Create New User"
        onSubmit={handleCreateUser}
        submitText="Create User"
      >
        <UserForm
          formData={formData}
          setFormData={setFormData}
          groups={groups}
          courses={courses}
          errors={formErrors}
        />
      </Modal>

      {/* Edit User Modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit User"
        onSubmit={handleUpdateUser}
        submitText="Update User"
      >
        <UserForm
          formData={formData}
          setFormData={setFormData}
          groups={groups}
          courses={courses}
          errors={formErrors}
        />

      </Modal>

      {/* Generated Password Modal */}
      <Modal
        open={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="User Created Successfully"
        onSubmit={() => setShowPasswordModal(false)}
        submitText="Done"
      >
        <div className="space-y-4">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
            <p className="text-green-800 dark:text-green-400 text-sm">
              The user has been created with an auto-generated password.
            </p>
          </div>
          
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Generated Password</Label>
            <div className="flex items-center gap-2">
              <div className="bg-gray-100 dark:bg-secondary border border-gray-200 dark:border-border rounded-md p-3 flex-1 font-mono text-lg tracking-wider text-center select-all">
                {generatedPassword}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-[54px] w-[54px]"
                onClick={() => {
                  if (generatedPassword) {
                    navigator.clipboard.writeText(generatedPassword);
                    toast('Password copied to clipboard', 'success');
                  }
                }}
                title="Copy Password"
              >
                <Copy className="h-5 w-5" />
              </Button>
            </div>
          </div>
          
<p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Please copy and share this password with the user. It will not be shown again.
        </p>
        </div>
      </Modal>

      {/* Create Group Modal */}
      <Modal
        open={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        title="Create New Group"
        onSubmit={handleCreateGroup}
        submitText="Create Group"
      >
        <GroupForm
          formData={groupFormData}
          setFormData={setGroupFormData}
          teachers={teachers}
          curators={curators}
          students={students}
          courses={courses}
          errors={groupFormErrors}
        />
      </Modal>

      {/* Edit Group Modal */}
      <Modal
        open={showEditGroupModal}
        onClose={() => {
          setShowEditGroupModal(false);
          resetEditGroupForm();
        }}
        title="Edit Group"
        onSubmit={handleUpdateGroup}
        submitText="Update Group"
      >
        <GroupForm
          formData={editGroupFormData}
          setFormData={setEditGroupFormData}
          teachers={teachers}
          curators={curators}
          students={students}
          courses={courses}
          errors={editGroupFormErrors}
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
        title={selectedUser ? "Deactivate User" : "Deactivate Group"}
        onSubmit={selectedUser ? handleDeleteUser : handleDeleteGroup}
        submitText="Deactivate"
      >
        <div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {selectedUser ? (
              <>Are you sure you want to deactivate <strong>{selectedUser.name}</strong>? This action can be undone later.</>
            ) : (
              <>Are you sure you want to deactivate <strong>{selectedGroup?.name}</strong>? This action can be undone later by reactivating the group.</>
            )}
          </p>
        </div>
      </Modal>

      {/* Bulk Add Students Modal */}
      <Modal
        open={showBulkAddModal}
        onClose={() => setShowBulkAddModal(false)}
        title="Bulk Add Students to Group"
        onSubmit={handleBulkAddStudents}
        submitText="Add Students"
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
        title="Import Students from Text"
        onSubmit={handleBulkTextUpload}
        submitText={isBulkTextLoading ? "Importing..." : "Import Students"}
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
          onSuccess={() => toast('Schedule updated successfully', 'success')}
      />

      {/* Bulk Schedule Upload Modal */}
      <Modal
        open={showBulkScheduleModal}
        onClose={() => setShowBulkScheduleModal(false)}
        title="Bulk Schedule Upload"
        onSubmit={handleBulkScheduleUpload}
        submitText={isBulkScheduleLoading ? "Uploading..." : "Upload Schedules"}
      >
        <div className="space-y-4">
          <div className="p-1">
            <Label className="text-sm font-medium">Schedule Data (TSV Format)</Label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-2">
              Format: Date [tab] Student [tab] Teacher [tab] Course [tab] Lessons [tab] Shorthand
            </p>
            <textarea
              value={bulkScheduleText}
              onChange={(e) => setBulkScheduleText(e.target.value)}
              placeholder="February 5 2026	Student Name	Teacher Name	SAT 4 months	48	пн ср пт 20 00"
              className="w-full h-64 p-3 border rounded-md text-sm font-mono resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isBulkScheduleLoading}
            />
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {bulkScheduleText.trim().split('\n').filter(l => l.trim()).length} lines detected
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBulkScheduleText('')}
                className="h-6 text-xs"
                type="button"
                disabled={isBulkScheduleLoading}
              >
                Clear
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
  errors?: { [key: string]: string };
}

function UserForm({ formData, setFormData, groups, courses, errors = {} }: UserFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="p-1">
          <Label htmlFor="name" className="text-sm font-medium">Name</Label>
          <Input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            className={errors.name ? 'border-red-500' : ''}
          />
          {errors.name && (
            <p className="text-red-500 text-xs mt-1">{errors.name}</p>
          )}
        </div>
        
        <div className="p-1">
          <Label htmlFor="email" className="text-sm font-medium">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            className={errors.email ? 'border-red-500' : ''}
          />
          {errors.email && (
            <p className="text-red-500 text-xs mt-1">{errors.email}</p>
          )}
        </div>
      </div>
      
        <div className="p-1">
          <Label htmlFor="role" className="text-sm font-medium">Role</Label>
          <Select
            value={formData.role}
            onValueChange={(value) => {
              const newRole = value as any;
              setFormData({ 
                ...formData, 
                role: newRole,
                // Clear groups if role is not student
                group_ids: newRole === 'student' ? formData.group_ids : [],
                course_ids: newRole === 'head_teacher' ? formData.course_ids : []
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent className="z-[1100]">
              <SelectItem value="student">Student</SelectItem>
              <SelectItem value="teacher">Teacher</SelectItem>
              <SelectItem value="head_teacher">Head Teacher</SelectItem>
              <SelectItem value="head_curator">Head Curator</SelectItem>
              <SelectItem value="curator">Curator</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Groups field - checkboxes for multiple selection (students only) */}
        {formData.role === 'student' && (
          <div className="p-1">
            <Label className="text-sm font-medium">Groups</Label>
            <div className="mt-2 max-h-40 overflow-y-auto space-y-2 border rounded-md p-3">
              {groups && groups.length > 0 ? (
                groups.map((group) => (
                  <div key={group.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`group-${group.id}`}
                      checked={formData.group_ids.includes(group.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({
                            ...formData,
                            group_ids: [...formData.group_ids, group.id]
                          });
                        } else {
                          setFormData({
                            ...formData,
                            group_ids: formData.group_ids.filter(id => id !== group.id)
                          });
                        }
                      }}
                    />
                    <Label htmlFor={`group-${group.id}`} className="text-sm font-normal cursor-pointer">
                      {group.name}
                    </Label>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No groups available</p>
              )}
            </div>
            {formData.group_ids.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Selected: {formData.group_ids.length} group(s)
              </p>
            )}
          </div>
        )}

        {/* Courses field - checkboxes for multiple selection (head_teacher only) */}
        {formData.role === 'head_teacher' && (
          <div className="p-1">
            <Label className="text-sm font-medium">Assigned Courses</Label>
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
                <p className="text-sm text-gray-500 dark:text-gray-400">No courses available</p>
              )}
            </div>
            {formData.course_ids.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Selected: {formData.course_ids.length} course(s)
              </p>
            )}
          </div>
        )}
      
      <div className="p-1">
        <Label htmlFor="student_id" className="text-sm font-medium">Student ID</Label>
        <Input
          id="student_id"
          type="text"
          value={formData.student_id || ''}
          onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
          placeholder="Optional"
        />
      </div>
      
      <div className="p-1">
        <Label htmlFor="password" className="text-sm font-medium">Password</Label>
        <Input
          id="password"
          type="password"
          value={formData.password || ''}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          placeholder="Leave empty for auto-generation"
        />
      </div>
      
      <div className="flex items-center space-x-2">
        <Checkbox
          id="is_active"
          checked={formData.is_active}
          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked as boolean })}
        />
        <Label htmlFor="is_active" className="text-sm">
          Active
        </Label>
      </div>
    </div>
  );
}

// Group Form Component
interface GroupFormProps {
  formData: GroupFormData;
  setFormData: (data: GroupFormData) => void;
  teachers: User[];
  curators: User[];
  students: User[];
  courses: Course[]; // Добавляем список курсов
  errors?: { [key: string]: string };
}

function GroupForm({ formData, setFormData, teachers, curators, students, courses, errors = {} }: GroupFormProps) {
  // Функция для генерации названия группы
  const generateGroupName = (teacherName: string, description?: string) => {
    const firstName = teacherName.split(" ")[0]; // Берем только первое имя
    const suffix = description?.trim() || 'Group';
    return `${firstName} - ${suffix}`;
  };

  // Автоматически обновляем название группы при изменении учителя или описания
  React.useEffect(() => {
    if (formData.teacher_id) {
      const selectedTeacher = teachers.find(t => Number(t.id) === formData.teacher_id);
      if (selectedTeacher) {
        const teacherName = selectedTeacher.name || selectedTeacher.full_name;
        const newName = generateGroupName(teacherName, formData.description);
        setFormData({ ...formData, name: newName });
      }
    }
  }, [formData.teacher_id, formData.description]);

  return (
    <div className="space-y-4">
      {/* Сначала выбор учителя и куратора */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-1">
          <Label htmlFor="teacher" className="text-sm font-medium">Teacher</Label>
          <Select
            value={formData.teacher_id?.toString() || ''}
            onValueChange={(value) => setFormData({ ...formData, teacher_id: parseInt(value) })}
          >
            <SelectTrigger className={errors.teacher_id ? 'border-red-500' : ''}>
              <SelectValue placeholder="Select teacher" />
            </SelectTrigger>
            <SelectContent className="z-[1100]">
              {teachers.map((teacher) => (
                <SelectItem key={teacher.id} value={teacher.id.toString()}>
                  {teacher.name || teacher.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.teacher_id && (
            <p className="text-red-500 text-xs mt-1">{errors.teacher_id}</p>
          )}
        </div>
        
        <div className="p-1">
          <Label htmlFor="curator" className="text-sm font-medium">Curator</Label>
          <Select
            value={formData.curator_id?.toString() || 'none'}
            onValueChange={(value) => setFormData({ ...formData, curator_id: value && value !== 'none' ? parseInt(value) : undefined })}
          >
            <SelectTrigger>
              <SelectValue placeholder="No curator" />
            </SelectTrigger>
            <SelectContent className="z-[1100]">
              <SelectItem value="none">No curator</SelectItem>
              {curators.map((curator) => (
                <SelectItem key={curator.id} value={curator.id.toString()}>
                  {curator.name || curator.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Выбор курса */}
      <div className="p-1">
        <Label htmlFor="course" className="text-sm font-medium">Course (Optional)</Label>
        <Select
          value={formData.course_id?.toString() || 'none'}
          onValueChange={(value) => setFormData({ ...formData, course_id: value && value !== 'none' ? parseInt(value) : undefined })}
        >
          <SelectTrigger>
            <SelectValue placeholder="No course" />
          </SelectTrigger>
          <SelectContent className="z-[1100]">
            <SelectItem value="none">No course</SelectItem>
            {courses.map((course) => (
              <SelectItem key={course.id} value={course.id.toString()}>
                {course.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Select a course to automatically grant this group access
        </p>
      </div>
      
      {/* Затем название группы с автогенерацией */}
      <div className="p-1">
        <Label htmlFor="group_name" className="text-sm font-medium">Group Name</Label>
        <Input
          id="group_name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          className={errors.name ? 'border-red-500' : ''}
          placeholder="Group name will be auto-generated when teacher is selected"
        />
        {errors.name && (
          <p className="text-red-500 text-xs mt-1">{errors.name}</p>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Format: "First Name - Description". You can edit this field.
        </p>
      </div>
      
      {/* Описание группы */}
      <div className="p-1">
        <Label htmlFor="description" className="text-sm font-medium">Description</Label>
        <Input
          id="description"
          type="text"
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Optional description (will be used in group name)"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          This description will be used in the group name format: "Teacher - Description"
        </p>
      </div>
      
      <div className="p-1">
        <Label className="text-sm font-medium">Students (Optional)</Label>
        <div className="mt-2 max-h-40 overflow-y-auto border rounded-md p-2 space-y-2">
          {students.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No students available</p>
          ) : (
            students.map((student) => (
              <div key={student.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`student-${student.id}`}
                  checked={formData.student_ids.includes(Number(student.id))}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setFormData({
                        ...formData,
                        student_ids: [...formData.student_ids, Number(student.id)]
                      });
                    } else {
                      setFormData({
                        ...formData,
                        student_ids: formData.student_ids.filter(id => id !== Number(student.id))
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
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Selected: {formData.student_ids.length} student(s)
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
          Active
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
  const [searchTerm, setSearchTerm] = useState("");
  
  // Filter students based on search term
  const filteredStudents = students.filter(student => 
    (student.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
     student.email?.toLowerCase().includes(searchTerm.toLowerCase())) &&
    student.role === 'student' &&
    student.is_active
  );

  // Toggle student selection
  const toggleStudent = (studentId: number) => {
    if (formData.studentIds.includes(studentId)) {
      setFormData({
        ...formData,
        studentIds: formData.studentIds.filter(id => id !== studentId)
      });
    } else {
      setFormData({
        ...formData,
        studentIds: [...formData.studentIds, studentId]
      });
    }
  };

  // Select all filtered students
  const selectAllFiltered = () => {
    const newIds = [...formData.studentIds];
    filteredStudents.forEach(student => {
      if (!newIds.includes(Number(student.id))) {
        newIds.push(Number(student.id));
      }
    });
    setFormData({ ...formData, studentIds: newIds });
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
        <Label htmlFor="group" className="text-sm font-medium">Select Group</Label>
        <Select
          value={formData.groupId?.toString() || ''}
          onValueChange={(value) => setFormData({ ...formData, groupId: parseInt(value) })}
        >
          <SelectTrigger className={errors.groupId ? 'border-red-500' : ''}>
            <SelectValue placeholder="Select a group" />
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
          <p className="text-red-500 text-xs mt-1">{errors.groupId}</p>
        )}
      </div>

      <div className="p-1">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium">Select Students</Label>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={selectAllFiltered}
              className="h-6 text-xs"
              type="button"
            >
              Select All
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={deselectAllFiltered}
              className="h-6 text-xs"
              type="button"
            >
              Deselect All
            </Button>
          </div>
        </div>
        
        <Input
          placeholder="Search students..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mb-2"
        />

        <div className="mt-2 max-h-60 overflow-y-auto border rounded-md p-2 space-y-2">
          {filteredStudents.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">No students found</p>
          ) : (
            filteredStudents.map((student) => (
              <div key={student.id} className="flex items-center space-x-2 hover:bg-gray-50 dark:hover:bg-secondary p-1 rounded">
                <Checkbox
                  id={`bulk-student-${student.id}`}
                  checked={formData.studentIds.includes(Number(student.id))}
                  onCheckedChange={() => toggleStudent(Number(student.id))}
                />
                <Label htmlFor={`bulk-student-${student.id}`} className="text-sm cursor-pointer flex-1">
                  <div className="font-medium">{student.name || student.full_name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{student.email}</div>
                </Label>
              </div>
            ))
          )}
        </div>
        
        <div className="flex justify-between items-center mt-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Selected: {formData.studentIds.length} student(s)
          </p>
          {errors.studentIds && (
            <p className="text-red-500 text-xs">{errors.studentIds}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Bulk Text Upload Form Component
interface BulkTextUploadFormProps {
  formData: { text: string; groupIds: number[] };
  setFormData: (data: { text: string; groupIds: number[] }) => void;
  groups: GroupWithDetails[];
  results: {
    created: Array<{ user: User; generated_password?: string }>;
    failed: Array<{ email: string; error: string }>;
  } | null;
  isLoading: boolean;
}

function BulkTextUploadForm({ formData, setFormData, groups, results, isLoading }: BulkTextUploadFormProps) {
  const exampleText = `Ибрагим Саида Асланкызы\t87756486372\tноябрь, декабрь\tDecember 3 2025\tibragim.saida@mail.ru
Кокорев Руслан Владимирович\t87077492110\tмарт\tDecember 3 2025\trkokorev73@gmail.com`;

  return (
    <div className="space-y-4">
      <div className="p-1">
        <Label className="text-sm font-medium">Student Data (Tab-separated)</Label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-2">
          Paste data with columns: Name, Phone, Months, Date, Email (separated by tabs)
        </p>
        <textarea
          value={formData.text}
          onChange={(e) => setFormData({ ...formData, text: e.target.value })}
          placeholder={exampleText}
          className="w-full h-48 p-3 border rounded-md text-sm font-mono resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isLoading}
        />
        <div className="flex justify-between items-center mt-1">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {formData.text.trim().split('\n').filter(l => l.trim()).length} lines detected
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFormData({ ...formData, text: '' })}
            className="h-6 text-xs"
            type="button"
            disabled={isLoading}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="p-1">
        <Label className="text-sm font-medium">Assign to Groups (Optional)</Label>
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
            <p className="text-sm text-gray-500 dark:text-gray-400">No groups available</p>
          )}
        </div>
        {formData.groupIds.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Selected: {formData.groupIds.length} group(s)
          </p>
        )}
      </div>

      {/* Results Section */}
      {results && (
        <div className="space-y-3 border-t pt-4">
          <h4 className="font-medium text-sm">Import Results</h4>
          
          {results.created.length > 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3">
              <div className="flex justify-between items-center mb-2">
                <h5 className="text-green-800 dark:text-green-400 font-medium text-sm">
                  ✓ Successfully created ({results.created.length})
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
                    alert('Скопировано! Формат: Имя, Email, Пароль (через Tab)');
                  }}
                >
                  📋 Копировать все
                </Button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {results.created.map((item, idx) => (
                  <div key={idx} className="text-xs text-green-700 dark:text-green-400 flex justify-between items-center bg-white dark:bg-card p-2 rounded">
                    <span>{item.user.name} ({item.user.email})</span>
                    {item.generated_password && (
                      <code className="bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded text-green-800 dark:text-green-400 cursor-pointer hover:bg-green-200 dark:hover:bg-green-800/50"
                        onClick={() => {
                          navigator.clipboard.writeText(item.generated_password!);
                        }}
                        title="Нажмите чтобы скопировать"
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
              <h5 className="text-red-800 dark:text-red-400 font-medium text-sm mb-2">
                ✗ Failed ({results.failed.length})
              </h5>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {results.failed.map((item, idx) => (
                  <div key={idx} className="text-xs text-red-700 dark:text-red-400 bg-white dark:bg-card p-2 rounded">
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
