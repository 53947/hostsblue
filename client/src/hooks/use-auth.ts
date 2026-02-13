import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import { useNavigate } from 'react-router-dom';

interface AuthState {
  customer: any | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

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
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password),
    onSuccess: (data) => {
      localStorage.setItem('accessToken', data.tokens.accessToken);
      localStorage.setItem('refreshToken', data.tokens.refreshToken);
      queryClient.setQueryData(['auth', 'me'], data.customer);
      navigate('/dashboard');
    },
  });

  const registerMutation = useMutation({
    mutationFn: (data: { email: string; password: string; firstName: string; lastName: string }) =>
      authApi.register(data),
    onSuccess: (data) => {
      localStorage.setItem('accessToken', data.tokens.accessToken);
      localStorage.setItem('refreshToken', data.tokens.refreshToken);
      queryClient.setQueryData(['auth', 'me'], data.customer);
      navigate('/dashboard');
    },
  });

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
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
