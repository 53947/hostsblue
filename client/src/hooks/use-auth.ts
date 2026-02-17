import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import { useNavigate } from 'react-router-dom';

export function useAuth() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: customer, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.me,
    retry: false,
    staleTime: Infinity,
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => authApi.login(email, password),
    onSuccess: (data) => {
      queryClient.setQueryData(['auth', 'me'], data.customer);
      navigate('/dashboard');
    },
  });

  const registerMutation = useMutation({
    mutationFn: (data: { email: string; password: string; firstName: string; lastName: string }) => authApi.register(data),
    onSuccess: (data) => {
      queryClient.setQueryData(['auth', 'me'], data.customer);
      navigate('/dashboard');
    },
  });

  const logout = async () => {
    try { await authApi.logout(); } catch {}
    queryClient.clear();
    navigate('/');
  };

  return {
    customer: customer || null,
    isAuthenticated: !!customer,
    isLoading,
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    logout,
    isLoginLoading: loginMutation.isPending,
    isRegisterLoading: registerMutation.isPending,
    loginError: loginMutation.error,
    registerError: registerMutation.error,
  };
}
