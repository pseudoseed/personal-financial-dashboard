import { useState } from "react";
import { ACCOUNT_TYPES, AccountType } from "@/lib/accountTypes";
import { calculateNextPaymentDate } from "@/lib/recurringPaymentUtils";

interface ManualAccountFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function ManualAccountForm({
  onSuccess,
  onCancel,
}: ManualAccountFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecurringPayment, setIsRecurringPayment] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "depository" as AccountType,
    subtype: "checking",
    balance: "",
    url: "",
    // Recurring payment fields
    paymentAmount: "",
    frequency: "bi-weekly" as string,
    nextPaymentDate: "",
    dayOfWeek: "5" as string, // Friday
    dayOfMonth: "" as string,
    paymentType: "paycheck" as string,
    metadata: {
      address: "",
      city: "",
      state: "",
      zipCode: "",
      purchasePrice: "",
      purchaseDate: "",
      propertyType: "single_family",
      squareFeet: "",
      yearBuilt: "",
    },
  });

  const accountTypes = Object.entries(ACCOUNT_TYPES).map(([value, type]) => ({
    value,
    label: type.label,
  }));

  const subtypes = {
    depository: ACCOUNT_TYPES.depository.subtypes,
    credit: ACCOUNT_TYPES.credit.subtypes,
    loan: ACCOUNT_TYPES.loan.subtypes,
    investment: ACCOUNT_TYPES.investment.subtypes,
    asset: ACCOUNT_TYPES.asset.subtypes,
    other: ACCOUNT_TYPES.other.subtypes,
  };

  const propertyTypes = [
    { value: "single_family", label: "Single Family" },
    { value: "multi_family", label: "Multi Family" },
    { value: "condo", label: "Condo" },
    { value: "townhouse", label: "Townhouse" },
    { value: "land", label: "Land" },
    { value: "commercial", label: "Commercial" },
  ];

  const frequencies = [
    { value: "weekly", label: "Weekly" },
    { value: "bi-weekly", label: "Bi-weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" },
    { value: "yearly", label: "Yearly" },
  ];

  const paymentTypes = [
    { value: "paycheck", label: "Paycheck" },
    { value: "direct_deposit", label: "Direct Deposit" },
    { value: "investment_dividend", label: "Investment Dividend" },
    { value: "other", label: "Other" },
  ];

  const daysOfWeek = [
    { value: "0", label: "Sunday" },
    { value: "1", label: "Monday" },
    { value: "2", label: "Tuesday" },
    { value: "3", label: "Wednesday" },
    { value: "4", label: "Thursday" },
    { value: "5", label: "Friday" },
    { value: "6", label: "Saturday" },
  ];

  const daysOfMonth = Array.from({ length: 31 }, (_, i) => ({
    value: (i + 1).toString(),
    label: (i + 1).toString(),
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isRecurringPayment) {
        // Create recurring payment
        const payload = {
          name: formData.name,
          amount: parseFloat(formData.paymentAmount),
          frequency: formData.frequency,
          nextPaymentDate: formData.nextPaymentDate,
          dayOfWeek: formData.dayOfWeek ? parseInt(formData.dayOfWeek) : null,
          dayOfMonth: formData.dayOfMonth ? parseInt(formData.dayOfMonth) : null,
          paymentType: formData.paymentType,
          targetAccountId: null, // Will be set to the created account
          isActive: true,
          isConfirmed: true,
          confidence: 100,
        };

        const response = await fetch("/api/recurring-payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error("Failed to create recurring payment");
        }
      } else {
        // Create regular manual account
        const payload = {
          ...formData,
          metadata:
            formData.type === "asset" && formData.subtype === "real_estate"
              ? JSON.stringify(formData.metadata)
              : null,
        };

        const response = await fetch("/api/accounts/manual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error("Failed to create account");
        }
      }

      onSuccess();
    } catch (error) {
      console.error("Error creating account/payment:", error);
      alert("Failed to create account/payment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFrequencyChange = (frequency: string) => {
    setFormData(prev => {
      const newData = { ...prev, frequency };
      
      // Auto-calculate next payment date based on frequency
      if (prev.nextPaymentDate) {
        const currentDate = new Date(prev.nextPaymentDate);
        const nextDate = calculateNextPaymentDate(
          currentDate,
          frequency,
          prev.dayOfWeek ? parseInt(prev.dayOfWeek) : null,
          prev.dayOfMonth ? parseInt(prev.dayOfMonth) : null
        );
        newData.nextPaymentDate = nextDate.toISOString().split('T')[0];
      }
      
      return newData;
    });
  };

  const isRealEstate =
    formData.type === "asset" && formData.subtype === "real_estate";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Account Type Toggle */}
      <div className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <label className="flex items-center">
          <input
            type="radio"
            checked={!isRecurringPayment}
            onChange={() => setIsRecurringPayment(false)}
            className="rounded border-gray-300 text-blue-600 focus:outline-none"
          />
          <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">Regular Account</span>
        </label>
        <label className="flex items-center">
          <input
            type="radio"
            checked={isRecurringPayment}
            onChange={() => setIsRecurringPayment(true)}
            className="rounded border-gray-300 text-blue-600 focus:outline-none"
          />
          <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">Recurring Payment</span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {isRecurringPayment ? "Payment Name" : "Account Name"}
        </label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-base shadow-sm focus:outline-none"
          placeholder={isRecurringPayment ? "e.g., Bi-weekly Paycheck" : "e.g., Personal Checking"}
        />
      </div>

      {!isRecurringPayment && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Reference URL
            </label>
            <input
              type="url"
              value={formData.url}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, url: e.target.value }))
              }
              className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-base shadow-sm focus:outline-none"
              placeholder="e.g., https://www.zillow.com/homedetails/..."
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Optional: Link to external reference for this account&apos;s value
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Account Type
            </label>
            <select
              required
              value={formData.type}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  type: e.target.value as AccountType,
                  subtype: subtypes[e.target.value as AccountType][0].value,
                }))
              }
              className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-base shadow-sm focus:outline-none"
            >
              {accountTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Subtype
            </label>
            <select
              required
              value={formData.subtype}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, subtype: e.target.value }))
              }
              className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-base shadow-sm focus:outline-none"
            >
              {subtypes[formData.type].map((subtype) => (
                <option key={subtype.value} value={subtype.value}>
                  {subtype.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Current Value
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
                className="pl-7 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-base shadow-sm focus:outline-none"
                placeholder="0.00"
              />
            </div>
          </div>
        </>
      )}

      {isRecurringPayment && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Payment Amount
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                required
                step="0.01"
                min="0"
                value={formData.paymentAmount}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, paymentAmount: e.target.value }))
                }
                className="pl-7 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-base shadow-sm focus:outline-none"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Payment Type
            </label>
            <select
              required
              value={formData.paymentType}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, paymentType: e.target.value }))
              }
              className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-base shadow-sm focus:outline-none"
            >
              {paymentTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Frequency
            </label>
            <select
              required
              value={formData.frequency}
              onChange={(e) => handleFrequencyChange(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-base shadow-sm focus:outline-none"
            >
              {frequencies.map((freq) => (
                <option key={freq.value} value={freq.value}>
                  {freq.label}
                </option>
              ))}
            </select>
          </div>

          {(formData.frequency === 'weekly' || formData.frequency === 'bi-weekly') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Day of Week
              </label>
              <select
                required
                value={formData.dayOfWeek}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, dayOfWeek: e.target.value }))
                }
                className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-base shadow-sm focus:outline-none"
              >
                {daysOfWeek.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {formData.frequency === 'monthly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Day of Month
              </label>
              <select
                required
                value={formData.dayOfMonth}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, dayOfMonth: e.target.value }))
                }
                className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-base shadow-sm focus:outline-none"
              >
                {daysOfMonth.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Next Payment Date
            </label>
            <input
              type="date"
              required
              value={formData.nextPaymentDate}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, nextPaymentDate: e.target.value }))
              }
              className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-base shadow-sm focus:outline-none"
            />
          </div>
        </>
      )}

      {isRealEstate && !isRecurringPayment && (
        <div className="space-y-4 border-t pt-4 mt-4">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">Property Details</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Street Address
              </label>
              <input
                type="text"
                required
                value={formData.metadata.address}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    metadata: { ...prev.metadata, address: e.target.value },
                  }))
                }
                className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-base shadow-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                City
              </label>
              <input
                type="text"
                required
                value={formData.metadata.city}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    metadata: { ...prev.metadata, city: e.target.value },
                  }))
                }
                className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-base shadow-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                State
              </label>
              <input
                type="text"
                required
                value={formData.metadata.state}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    metadata: { ...prev.metadata, state: e.target.value },
                  }))
                }
                className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-base shadow-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                ZIP Code
              </label>
              <input
                type="text"
                required
                value={formData.metadata.zipCode}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    metadata: { ...prev.metadata, zipCode: e.target.value },
                  }))
                }
                className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-base shadow-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Property Type
              </label>
              <select
                required
                value={formData.metadata.propertyType}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    metadata: {
                      ...prev.metadata,
                      propertyType: e.target.value,
                    },
                  }))
                }
                className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-base shadow-sm focus:outline-none"
              >
                {propertyTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Square Feet
              </label>
              <input
                type="number"
                required
                value={formData.metadata.squareFeet}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    metadata: { ...prev.metadata, squareFeet: e.target.value },
                  }))
                }
                className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-base shadow-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Year Built
              </label>
              <input
                type="number"
                required
                value={formData.metadata.yearBuilt}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    metadata: { ...prev.metadata, yearBuilt: e.target.value },
                  }))
                }
                className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-base shadow-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Purchase Price
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  required
                  step="0.01"
                  value={formData.metadata.purchasePrice}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      metadata: {
                        ...prev.metadata,
                        purchasePrice: e.target.value,
                      },
                    }))
                  }
                  className="pl-7 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-base shadow-sm focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Purchase Date
              </label>
              <input
                type="date"
                required
                value={formData.metadata.purchaseDate}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    metadata: {
                      ...prev.metadata,
                      purchaseDate: e.target.value,
                    },
                  }))
                }
                className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-base shadow-sm focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-purple-600 dark:bg-purple-500 border border-transparent rounded-md shadow-sm hover:bg-purple-700 dark:hover:bg-purple-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
        >
          {isSubmitting ? "Adding..." : (isRecurringPayment ? "Add Payment" : "Add Account")}
        </button>
      </div>
    </form>
  );
}
