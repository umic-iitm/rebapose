import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { USERS, CREDENTIALS } from "../mockData";
import { useCurrentUser, loadData } from "../store";
import * as api from "../api";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useCurrentUser();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) { setError("Select a user"); return; }

    setLoading(true);
    setError("");
    try {
      const result = await api.login(selectedUser, password);
      sessionStorage.setItem("authToken", result.token);
      login(selectedUser);
      await loadData();
      navigate("/review");
    } catch {
      if (password !== CREDENTIALS[selectedUser]) {
        setError("Wrong password");
        setLoading(false);
        return;
      }
      login(selectedUser);
      await loadData();
      navigate("/review");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-2">REBAShotSelection</h1>
          <p className="text-gray-400">Photo curation &middot; 2 reviewers + admin</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-gray-900 rounded-2xl p-8 border border-gray-800"
        >
          <h2 className="text-lg font-medium text-gray-300 mb-6 text-center">
            Sign in
          </h2>

          <div className="space-y-3 mb-6">
            {Object.values(USERS).map((user) => (
              <button
                key={user.id}
                type="button"
                data-testid={`user-${user.id}`}
                onClick={() => {
                  setSelectedUser(user.id);
                  setError("");
                }}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                  selectedUser === user.id
                    ? "bg-blue-600/20 border-blue-500 ring-1 ring-blue-500"
                    : "bg-gray-800 border-gray-700 hover:bg-gray-700 hover:border-gray-600"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${
                    user.role === "admin" ? "bg-purple-600" : "bg-blue-600"
                  }`}
                >
                  {user.avatar}
                </div>
                <div className="text-left">
                  <div className="text-white font-medium text-sm">{user.name}</div>
                  <div className="text-gray-500 text-xs">
                    {user.role === "admin" ? "Admin" : "Reviewer"}
                  </div>
                </div>
                {selectedUser === user.id && (
                  <svg
                    className="w-5 h-5 text-blue-400 ml-auto"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>

          <div className="mb-4">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p data-testid="login-error" className="text-red-400 text-sm text-center mb-4">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors cursor-pointer"
          >
            Sign In
          </button>
        </form>

        <p className="text-center text-gray-600 text-sm mt-6">
          Reviewers curate photos. Admin views and exports.
        </p>
      </div>
    </div>
  );
}
