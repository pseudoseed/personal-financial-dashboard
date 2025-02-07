import { useState } from "react";

interface ManualAccountFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function ManualAccountForm({
  onSuccess,
  onCancel,
}: ManualAccountFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "depository",
    subtype: "checking",
    balance: "",
  });

  const accountTypes = [
    { value: "depository", label: "Depository" },
    { value: "credit", label: "Credit" },
    { value: "loan", label: "Loan" },
    { value: "investment", label: "Investment" },
    { value: "other", label: "Other" },
  ];

  const subtypes = {
    depository: [
      { value: "checking", label: "Checking" },
      { value: "savings", label: "Savings" },
      { value: "cd", label: "CD" },
      { value: "money market", label: "Money Market" },
    ],
    credit: [
      { value: "credit card", label: "Credit Card" },
      { value: "line of credit", label: "Line of Credit" },
    ],
    loan: [
      { value: "mortgage", label: "Mortgage" },
      { value: "student", label: "Student Loan" },
      { value: "auto", label: "Auto Loan" },
      { value: "personal", label: "Personal Loan" },
    ],
    investment: [
      { value: "brokerage", label: "Brokerage" },
      { value: "retirement", label: "Retirement" },
      { value: "ira", label: "IRA" },
      { value: "401k", label: "401(k)" },
    ],
    other: [{ value: "other", label: "Other" }],
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/accounts/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to create account");
      }

      onSuccess();
    } catch (error) {
      console.error("Error creating manual account:", error);
      alert("Failed to create account. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Account Name
        </label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="e.g., Personal Checking"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Account Type
        </label>
        <select
          required
          value={formData.type}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              type: e.target.value,
              subtype:
                subtypes[e.target.value as keyof typeof subtypes][0].value,
            }))
          }
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          {accountTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Subtype
        </label>
        <select
          required
          value={formData.subtype}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, subtype: e.target.value }))
          }
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          {subtypes[formData.type as keyof typeof subtypes].map((subtype) => (
            <option key={subtype.value} value={subtype.value}>
              {subtype.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Current Balance
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">$</span>
          </div>
          <input
            type="number"
            required
            step="0.01"
            value={formData.balance}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, balance: e.target.value }))
            }
            className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isSubmitting ? "Adding..." : "Add Account"}
        </button>
      </div>
    </form>
  );
}
